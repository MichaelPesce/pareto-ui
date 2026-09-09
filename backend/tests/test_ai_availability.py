import os
import unittest
from unittest.mock import patch

from app.internal.openai_client_wrapper import OpenAIClientWrapper


class AIAvailabilityTests(unittest.TestCase):
    def test_missing_and_blank_keys_do_not_initialize_a_client(self):
        with patch.dict(os.environ, {'CBORG_API_KEY': '', 'OPENAI_API_KEY': ''}), \
                patch('app.internal.openai_client_wrapper.openai.OpenAI') as factory:
            for key in (None, '', '   ', '\t\n'):
                with self.subTest(key=repr(key)):
                    client = OpenAIClientWrapper(api_key=key)
                    self.assertFalse(client.is_available())
            factory.assert_not_called()

    def test_configured_key_enables_ai_and_clearing_it_disables_ai(self):
        with patch('app.internal.openai_client_wrapper.openai.OpenAI') as factory:
            client = OpenAIClientWrapper(api_key=' test-key ')
            self.assertTrue(client.is_available())
            factory.assert_called_once_with(api_key='test-key')
            client.set_api_key(' ')
            self.assertFalse(client.is_available())
            factory.assert_called_once()
            with self.assertRaisesRegex(RuntimeError, 'not configured'):
                client.chat('Unused prompt')


if __name__ == '__main__':
    unittest.main()
