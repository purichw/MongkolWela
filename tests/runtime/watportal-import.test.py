"""Offline parser checks; never crawl the source from the test suite."""
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("watportal", Path(__file__).resolve().parents[2] / "scripts/import-watportal-directory.py")
watportal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watportal)


class WatportalParserTest(unittest.TestCase):
    def test_listing_preserves_identity_and_location(self):
        rows = watportal.listing('''<div class="infocard"><div class="detail-title">
            <a href="/th/wat/region/detail/iid/34383">วัดหนองป่าพง</a></div>
            <div class="detail-address">วารินชำราบ, อุบลราชธานี</div></div>''')
        self.assertEqual(rows[0]["id"], "34383")
        self.assertEqual(rows[0]["province"], "อุบลราชธานี")
        self.assertEqual(rows[0]["district"], "วารินชำราบ")
        self.assertTrue(rows[0]["url"].startswith("https://www.watportal.com/"))
        with self.assertRaises(ValueError):
            watportal.listing('<div class="infocard">missing identity</div>')

    def test_unknown_facts_survive_without_guessing_missing_values(self):
        result = watportal.detail('''<div><span>ประเภทวัด :</span><span>วัดราษฎร์, วิปัสนากรรมฐาน</span></div>
            <div><span>หมวดหมู่ใหม่ :</span><span>เก็บไว้ในอนาคต</span></div>
            <div><span>นิกาย :</span><span></span></div>
            <iframe src="https://maps.google.com/maps?q=15.15875,104.8289768&amp;output=embed"></iframe>''')
        self.assertEqual(result["fields"]["หมวดหมู่ใหม่"], "เก็บไว้ในอนาคต")
        self.assertNotIn("นิกาย", result["fields"])
        self.assertEqual(result["coordinates"], {"latitude": 15.15875, "longitude": 104.8289768})

    def test_no_coordinates_invented_from_names_or_unrelated_frames(self):
        for html in ['<h1>วัดป่าทดสอบ</h1>', '<iframe src="https://example.com/?q=15,104"></iframe>',
                     '<iframe src="https://maps.google.com/maps?q=0,0"></iframe>']:
            self.assertIsNone(watportal.detail(html)["coordinates"])


if __name__ == "__main__":
    unittest.main()
