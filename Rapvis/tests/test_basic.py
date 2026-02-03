import os
import sys
import unittest

import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))

from data_processing import normalize_articles, add_period_string

class TestDataProcessing(unittest.TestCase):
    def test_normalize_articles(self):
        input_series = pd.Series([" 123 ", "abc-def", "FOO bar"])
        expected = pd.Series(["123", "ABCDEF", "FOOBAR"])
        # normalize_articles truncates to 10 chars, let's test that too
        input_long = pd.Series(["1234567890123"])
        expected_long = pd.Series(["1234567890"])
        
        result = normalize_articles(input_series)
        pd.testing.assert_series_equal(result, expected)
        
        result_long = normalize_articles(input_long)
        pd.testing.assert_series_equal(result_long, expected_long)

    def test_add_period_string_weeks(self):
        df = pd.DataFrame({
            "Week Start": pd.to_datetime(["2023-01-02", "2023-01-09"]) # Mondays
        })
        result = add_period_string(df, "weeks")
        self.assertIn("PeriodString", result.columns)
        # 2023-01-02 is Monday of week 1 in 2023
        self.assertEqual(result["PeriodString"].iloc[0], "2023-W01")
        self.assertEqual(result["PeriodString"].iloc[1], "2023-W02")

if __name__ == '__main__':
    unittest.main()
