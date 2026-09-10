"""Workbook replacement must not depend on garbage collection releasing readers."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import warnings

import pandas as pd
from openpyxl import Workbook
from pareto.utilities.get_data import DataLoadingError

from app.internal.get_data import _sheets_to_dfs
from app.internal.scenario_inputs import read_inputs, write_inputs


class WorkbookHandleTests(unittest.TestCase):
    def setUp(self):
        self.readers = []
        readers = self.readers

        class TrackedReader(pd.ExcelFile):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                readers.append(self)

        reader_patch = patch('app.internal.get_data.pd.ExcelFile', TrackedReader)
        reader_patch.start()
        self.addCleanup(reader_patch.stop)
        # Keep readers reachable; normal refcounting/GC must not hide missing close().
        self.addCleanup(lambda: [reader.close() for reader in readers])

    def assert_readers_closed(self):
        self.assertTrue(self.readers)
        for reader in self.readers:
            self.assertTrue(reader._reader.handles.handle.closed)
            self.assertIsNone(reader.book._archive.fp)

    def test_read_roundtrip_releases_handles_before_replacement(self):
        source = Path(__file__).resolve().parents[2] / 'examples/map-to-optimization/completed-inputs.xlsx'
        inputs = read_inputs(source)
        self.assert_readers_closed()
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'inputs.xlsx'
            write_inputs(inputs, target)
            restored = read_inputs(target)
            self.assert_readers_closed()
            # Exercise the same read/replace sequence that failed in Windows CI.
            write_inputs(restored, target)
            renamed = target.with_name('renamed.xlsx')
            target.replace(renamed)
            renamed.unlink()

    def test_failed_sheet_closes_reader_with_and_without_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'one-row.xlsx'
            workbook = Workbook()
            workbook.active.append(['Title only'])
            workbook.save(path)
            workbook.close()
            with self.assertRaises(DataLoadingError):
                _sheets_to_dfs(path, raises=True, header=1)
            self.assert_readers_closed()
            with warnings.catch_warnings(record=True) as emitted:
                tables = _sheets_to_dfs(path, raises=False, header=1)
            self.assertTrue(emitted)
            self.assertTrue(tables['Sheet'].empty)
            self.assert_readers_closed()
            path.unlink()


if __name__ == '__main__':
    unittest.main()
