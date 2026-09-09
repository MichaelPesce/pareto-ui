import asyncio
import json
import unittest
from unittest.mock import AsyncMock, Mock, patch

from fastapi import HTTPException
from app.internal.ai_configuration import AIConfiguration, AISettingsError
from app.internal.openai_client_wrapper import OpenAIClientWrapper
from app.routers import ai_settings


class AIConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.factory = patch('app.internal.openai_client_wrapper.openai.OpenAI').start()
        self.addCleanup(patch.stopall)
        self.environment = OpenAIClientWrapper(api_key='environment-secret', base_url='https://environment.example/v1', model='environment-model')
        self.config = AIConfiguration(self.environment)

    def test_user_override_and_environment_fallback_without_returning_credentials(self):
        result = self.config.configure('user-secret', 'https://user.example/v1/', 'user-model')
        self.assertEqual(result['source'], 'user')
        self.assertEqual(result['base_url'], 'https://user.example/v1')
        self.assertEqual(result['model'], 'user-model')
        self.assertNotIn('secret', json.dumps(result))
        self.assertNotIn('api_key', result)
        with patch.object(self.config.active_client, 'prompt', return_value='result') as user_prompt:
            self.assertEqual(self.config.prompt('test'), 'result')
            user_prompt.assert_called_once_with('test')
        self.assertEqual(self.config.reset()['source'], 'environment')
        self.assertIs(self.config.active_client, self.environment)

    def test_blank_key_retains_only_the_user_key_at_the_same_endpoint(self):
        with self.assertRaises(AISettingsError):
            self.config.configure('', 'https://environment.example/v1', 'model')
        self.config.configure('user-secret', 'https://user.example/v1', 'first')
        self.config.configure('', 'https://user.example/v1/', 'second')
        self.assertEqual(self.config.active_client.api_key, 'user-secret')
        self.assertEqual(self.config.active_client.model, 'second')
        with self.assertRaises(AISettingsError):
            self.config.configure('', 'https://different.example/v1', 'second')
        self.assertEqual(self.config.active_client.base_url, 'https://user.example/v1')

    def test_invalid_settings_leave_existing_configuration_unchanged(self):
        for url in ['http://remote.example/v1', 'https://user:secret@example.com', 'https://example.com?key=secret', 'not a URL']:
            with self.subTest(url=url), self.assertRaises(AISettingsError):
                self.config.configure('new-secret', url, 'model')
            self.assertIs(self.config.active_client, self.environment)
        self.config.configure('local-key', 'http://127.0.0.1:8000/v1', 'local-model')
        self.assertTrue(self.config.is_available())

    def test_provider_exceptions_do_not_expose_keys(self):
        with patch.object(self.environment, 'prompt', side_effect=RuntimeError('Rejected environment-secret')):
            with self.assertRaises(RuntimeError) as error:
                self.config.prompt('test')
            self.assertNotIn('environment-secret', str(error.exception))
            self.assertTrue(error.exception.__suppress_context__)

    def test_settings_routes_apply_and_remove_keys_without_exposing_them(self):
        self.environment.set_api_key(None)
        with patch.object(ai_settings, 'ai_configuration', self.config):
            self.assertFalse(ai_settings.get_settings()['available'])
            request = Mock(json=AsyncMock(return_value={'api_key': 'user-secret', 'base_url': 'https://user.example/v1', 'model': 'model'}))
            result = asyncio.run(ai_settings.save_settings(request))
            self.assertTrue(result['available'])
            self.assertNotIn('user-secret', json.dumps(result))
            self.assertFalse(ai_settings.reset_settings()['available'])
            self.assertEqual(self.config.describe()['source'], 'none')
            with patch.object(self.config, 'configure', side_effect=ValueError('SDK failure with user-secret')):
                with self.assertRaises(HTTPException) as error:
                    asyncio.run(ai_settings.save_settings(request))
                self.assertNotIn('user-secret', error.exception.detail)


if __name__ == '__main__':
    unittest.main()
