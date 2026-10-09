import unittest

import openpyxl

from scripts import build_dashboard_data as builder


class HeaderNormalizationTests(unittest.TestCase):
    def test_existing_short_horizon_aliases_still_normalize(self) -> None:
        cases = {
            "1W": "1W",
            "1w": "1W",
            "1m": "1M",
            "1y": "12M",
            "2 weeks": "2W",
            "1 mo": "1M",
            "12 months": "12M",
        }

        for header, expected in cases.items():
            with self.subTest(header=header):
                self.assertEqual(builder.normalize_header(header), expected)

    def test_descriptive_horizons_with_matching_day_counts_normalize(self) -> None:
        cases = {
            "1-Week (5d)": "1W",
            "2-Week (10d)": "2W",
            "1-Month (21d)": "1M",
            "2-Month (42d)": "2M",
            "3-Month (63d)": "3M",
            "6-Month (126d)": "6M",
            "9-Month (189d)": "9M",
            "12-Month (252d)": "12M",
            "1 week [5 trading days]": "1W",
        }

        for header, expected in cases.items():
            with self.subTest(header=header):
                self.assertEqual(builder.normalize_header(header), expected)

    def test_descriptive_horizon_rejects_a_conflicting_day_count(self) -> None:
        header = "1-Week (10d)"

        self.assertEqual(builder.normalize_header(header), header)

    def test_descriptive_horizon_rejects_mismatched_brackets(self) -> None:
        header = "1-Week (5d]"

        self.assertEqual(builder.normalize_header(header), header)


class SignalCompletionTests(unittest.TestCase):
    @staticmethod
    def signal_with_return(value, has_source=True):
        source = {
            "series": [{"date": "2026-07-15", "asset": 100.0, "indicator": 1.0}]
            if has_source else []
        }
        results = {
            "signalRows": [{
                "date": "2026-07-14",
                "values": {"Entry Date": "2026-07-15", "12M": value},
            }]
        }
        return builder.enrich_signals(source, results)[0]

    def test_unavailable_return_markers_do_not_complete_a_window(self):
        for value in (None, "", " ", "—", "–", "-", "n/a", "#N/A", "pending", False):
            for has_source in (True, False):
                with self.subTest(value=value, has_source=has_source):
                    signal = self.signal_with_return(value, has_source)
                    self.assertFalse(signal["completed12M"])

    def test_numeric_returns_including_zero_remain_available(self):
        for value in (0, 0.0, -0.05, 0.12, "0%", "12.5%"):
            for has_source in (True, False):
                with self.subTest(value=value, has_source=has_source):
                    signal = self.signal_with_return(value, has_source)
                    self.assertTrue(signal["completed12M"])
                    # Keep numeric results subject to source-path validation.
                    self.assertLess(len(signal["performance"]), 253)


class ResultsTableDetectionTests(unittest.TestCase):
    def test_finds_table_with_descriptive_horizon_headers(self) -> None:
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Backtest Results"
        sheet.append(["Signal Date", "1-Week (5d)", "1-Month (21d)"])

        found_sheet, header_row, signal_date_col = builder.find_results_table(workbook)

        self.assertIs(found_sheet, sheet)
        self.assertEqual(header_row, 1)
        self.assertEqual(signal_date_col, 1)

    def test_reports_unrecognized_horizons_separately_from_missing_signal_date(self) -> None:
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        sheet.title = "Backtest Results"
        sheet.append(["Signal Date", "5-Day Return", "21-Day Return"])

        with self.assertRaisesRegex(ValueError, "fewer than two recognized"):
            builder.find_results_table(workbook)


if __name__ == "__main__":
    unittest.main()
