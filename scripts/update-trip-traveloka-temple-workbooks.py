from __future__ import annotations

from collections import defaultdict
from copy import copy
from datetime import date
from pathlib import Path
import re

from openpyxl import load_workbook, Workbook
from openpyxl.styles import Alignment, Font, PatternFill


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "outputs" / "9-temples-research"

CATEGORY_FILES = {
    "popular": OUTPUT_DIR / "make-merit-9-temples-dataset.xlsx",
    "mu": OUTPUT_DIR / "mu-temples-dataset.xlsx",
    "sacred": OUTPUT_DIR / "sacred-temples-dataset.xlsx",
}

GLOBAL_FILE = OUTPUT_DIR / "temple-global-ranking-dataset.xlsx"

CATEGORY_LABELS = {
    "popular": "สายไหว้พระ 9 วัด",
    "mu": "สายมู",
    "sacred": "วัดศักดิ์สิทธิ์",
}

REGION_BY_PROVINCE = {
    "กรุงเทพมหานคร": "ภาคกลาง",
    "พระนครศรีอยุธยา": "ภาคกลาง",
    "ปทุมธานี": "ภาคกลาง",
    "สมุทรปราการ": "ภาคกลาง",
    "สมุทรสาคร": "ภาคกลาง",
    "สมุทรสงคราม": "ภาคกลาง",
    "นครปฐม": "ภาคกลาง",
    "นนทบุรี": "ภาคกลาง",
    "อ่างทอง": "ภาคกลาง",
    "ชลบุรี": "ภาคตะวันออก",
    "ระยอง": "ภาคตะวันออก",
    "ฉะเชิงเทรา": "ภาคตะวันออก",
    "จันทบุรี": "ภาคตะวันออก",
    "เชียงใหม่": "ภาคเหนือ",
    "เชียงราย": "ภาคเหนือ",
    "น่าน": "ภาคเหนือ",
    "ลำปาง": "ภาคเหนือ",
    "ลำพูน": "ภาคเหนือ",
    "เลย": "ภาคตะวันออกเฉียงเหนือ",
    "ขอนแก่น": "ภาคตะวันออกเฉียงเหนือ",
    "นครราชสีมา": "ภาคตะวันออกเฉียงเหนือ",
    "อุดรธานี": "ภาคตะวันออกเฉียงเหนือ",
    "อุบลราชธานี": "ภาคตะวันออกเฉียงเหนือ",
    "สกลนคร": "ภาคตะวันออกเฉียงเหนือ",
    "ภูเก็ต": "ภาคใต้",
    "สงขลา": "ภาคใต้",
    "กระบี่": "ภาคใต้",
    "นครศรีธรรมราช": "ภาคใต้",
    "สุราษฎร์ธานี": "ภาคใต้",
}

ALIASES = {
    ("วัดพระศรีรัตนศาสดาราม", "กรุงเทพมหานคร"): "วัดพระแก้ว",
    ("วัดพระเชตุพนวิมลมังคลาราม", "กรุงเทพมหานคร"): "วัดโพธิ์",
    ("วัดพระเชตุพนวิมลมังคลารามราชวรมหาวิหาร", "กรุงเทพมหานคร"): "วัดโพธิ์",
    ("วัดอรุณราชวรารามราชวรมหาวิหาร", "กรุงเทพมหานคร"): "วัดอรุณ",
    ("วัดอรุณราชวราราม", "กรุงเทพมหานคร"): "วัดอรุณ",
    ("วัดกัลยาณมิตรวรมหาวิหาร", "กรุงเทพมหานคร"): "วัดกัลยาณมิตร",
    ("วัดกัลยาณมิตร วรมหาวิหาร", "กรุงเทพมหานคร"): "วัดกัลยาณมิตร",
    ("วัดระฆังโฆสิตารามวรมหาวิหาร", "กรุงเทพมหานคร"): "วัดระฆังโฆสิตาราม",
    ("วัดสระเกศราชวรมหาวิหาร", "กรุงเทพมหานคร"): "วัดสระเกศ",
    ("วัดสุทัศนเทพวรารามราชวรมหาวิหาร", "กรุงเทพมหานคร"): "วัดสุทัศนเทพวราราม",
    ("วัดชนะสงครามราชวรมหาวิหาร", "กรุงเทพมหานคร"): "วัดชนะสงคราม",
    ("วัดบวรนิเวศวิหาร ราชวรวิหาร", "กรุงเทพมหานคร"): "วัดบวรนิเวศวิหาร",
    ("วัดไตรมิตรวิทยารามวรวิหาร", "กรุงเทพมหานคร"): "วัดไตรมิตรวิทยาราม",
    ("วัดปากน้ำ ภาษีเจริญ", "กรุงเทพมหานคร"): "วัดปากน้ำภาษีเจริญ",
    ("วัดไชยธาราราม (วัดฉลอง)", "ภูเก็ต"): "วัดไชยธาราราม",
    ("วัดไชยธาราราม", "ภูเก็ต"): "วัดไชยธาราราม",
    ("วัดฉลอง", "ภูเก็ต"): "วัดไชยธาราราม",
    ("วัดพระใหญ่", "ภูเก็ต"): "วัดพระใหญ่ ภูเก็ต",
    ("วัดพระทอง (วัดพระผุด)", "ภูเก็ต"): "วัดพระทอง",
    ("พระธาตุแช่แห้ง", "น่าน"): "วัดพระธาตุแช่แห้ง",
    ("พระธาตุจอมปิง", "ลำปาง"): "วัดพระธาตุจอมปิง",
    ("พระธาตุขามแก่น", "ขอนแก่น"): "วัดเจติยภูมิ พระธาตุขามแก่น",
    ("วัดพระศรีสรรเพชญ์", "พระนครศรีอยุธยา"): "วัดพระศรีสรรเพชญ์",
    ("วัดพระศรีสรรเพชญ์", "พระนครศรีอยุธยา"): "วัดพระศรีสรรเพชญ์",
    ("วัดหน้าพระเมรุ", "พระนครศรีอยุธยา"): "วัดหน้าพระเมรุ",
    ("วัดเขาชีจรรย์", "ชลบุรี"): "เขาชีจรรย์",
    ("วัดปิบผลิวนาราม", "ระยอง"): "วัดปิปผลิวนาราม",
    ("วัดพระนารายณ์มหา", "นครราชสีมา"): "วัดพระนารายณ์มหาราช",
    ("วัดพระนารายณ์มหาราชวรวิหาร", "นครราชสีมา"): "วัดพระนารายณ์มหาราช",
}


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize_name(name, province):
    name = clean(name)
    name = re.sub(r"\s*ราชวรมหาวิหาร\s*$", "", name)
    name = re.sub(r"\s*วรมหาวิหาร\s*$", "", name)
    name = re.sub(r"\s*ราชวรวิหาร\s*$", "", name)
    name = re.sub(r"\s*วรวิหาร\s*$", "", name)
    return ALIASES.get((name, province), name)


def key_for(name, province):
    canonical = normalize_name(name, province)
    return f"{canonical}|{province}"


def split_list(value):
    if not value:
        return []
    return [item.strip() for item in re.split(r"\s*;\s*", str(value)) if item and item.strip()]


def join_unique(values):
    seen = []
    for value in values:
        for item in split_list(value) if isinstance(value, str) else [value]:
            item = clean(item)
            if item and item not in seen:
                seen.append(item)
    return "; ".join(seen)


def temple(
    name,
    province,
    district="",
    blessing="สิริมงคล",
    object_hero="พระประธาน",
    object_type="พระพุทธรูป",
    place_type="วัด",
    deity="",
    tags="วัดดัง; ทำบุญ; ขอพร",
):
    canonical = normalize_name(name, province)
    return {
        "name": canonical,
        "province": province,
        "district": district,
        "region": REGION_BY_PROVINCE.get(province, ""),
        "placeType": place_type,
        "blessingPrimary": blessing,
        "blessingCategories": blessing,
        "objectHero": object_hero,
        "objectHeroType": object_type,
        "deitySacredObject": deity or object_hero,
        "templeStyleTags": tags,
        "key": key_for(canonical, province),
    }


def with_defaults(items, **defaults):
    return [{**defaults, **item} for item in items]


def src(
    key,
    source_name,
    source_type,
    scope,
    url,
    route_name,
    temples,
    categories,
    route_duration="1 วัน",
    travel_mode="รถส่วนตัว/ขนส่งสาธารณะ",
    route_type="บทความ/เส้นทางแนะนำ",
    package_type="บทความ/แผนเดินทาง",
    confidence="medium-high",
):
    return {
        "key": key,
        "sourceName": source_name,
        "sourceType": source_type,
        "scope": scope,
        "url": url,
        "routeName": route_name,
        "routeScope": scope,
        "routeDuration": route_duration,
        "travelMode": travel_mode,
        "routeType": route_type,
        "tourCompany": source_name,
        "packageName": route_name,
        "packageType": package_type,
        "packagePrice": "",
        "temples": temples,
        "categories": categories,
        "confidence": confidence,
    }


BKK_CORE_9 = [
    temple("วัดสระเกศ", "กรุงเทพมหานคร", "พระนคร", "เสริมดวง; สิริมงคล", "ภูเขาทอง", "เจดีย์"),
    temple("วัดสุทัศนเทพวราราม", "กรุงเทพมหานคร", "พระนคร", "สิริมงคล; งาน", "พระศรีศากยมุนี", "พระพุทธรูป"),
    temple("วัดชนะสงคราม", "กรุงเทพมหานคร", "พระนคร", "ชนะอุปสรรค; งาน", "พระประธาน", "พระพุทธรูป"),
    temple("วัดพระแก้ว", "กรุงเทพมหานคร", "พระนคร", "สิริมงคล; คุ้มครอง", "พระแก้วมรกต", "พระพุทธรูป"),
    temple("วัดโพธิ์", "กรุงเทพมหานคร", "พระนคร", "สุขภาพ; ความสงบ", "พระพุทธไสยาส", "พระพุทธรูป"),
    temple("วัดราชบพิธสถิตมหาสีมาราม", "กรุงเทพมหานคร", "พระนคร", "สิริมงคล", "พระอุโบสถ", "สถาปัตยกรรม"),
    temple("วัดกัลยาณมิตร", "กรุงเทพมหานคร", "ธนบุรี", "มิตรไมตรี; ค้าขาย", "หลวงพ่อโต", "พระพุทธรูป"),
    temple("วัดอรุณ", "กรุงเทพมหานคร", "บางกอกใหญ่", "รุ่งโรจน์; สิริมงคล", "พระปรางค์วัดอรุณ", "พระปรางค์"),
    temple("วัดระฆังโฆสิตาราม", "กรุงเทพมหานคร", "บางกอกน้อย", "ชื่อเสียง; ความโด่งดัง", "ระฆังใหญ่", "ระฆัง"),
]

BKK_19 = [
    temple("ศาลหลักเมืองกรุงเทพมหานคร", "กรุงเทพมหานคร", "พระนคร", "หลักชีวิต; ความมั่นคง", "ศาลหลักเมือง", "ศาลหลักเมือง", "ศาลหลักเมือง", tags="ศาลหลักเมือง; สายมู; ขอพร"),
    temple("วัดพระแก้ว", "กรุงเทพมหานคร", "พระนคร", "สิริมงคล; คุ้มครอง", "พระแก้วมรกต", "พระพุทธรูป"),
    temple("วัดโพธิ์", "กรุงเทพมหานคร", "พระนคร", "สุขภาพ; ความสงบ", "พระพุทธไสยาส", "พระพุทธรูป"),
    temple("วัดสุทัศนเทพวราราม", "กรุงเทพมหานคร", "พระนคร", "สิริมงคล; งาน", "พระศรีศากยมุนี", "พระพุทธรูป"),
    temple("วัดราชบพิธสถิตมหาสีมาราม", "กรุงเทพมหานคร", "พระนคร", "สิริมงคล", "พระอุโบสถ", "สถาปัตยกรรม"),
    temple("วัดราชนัดดาราม", "กรุงเทพมหานคร", "พระนคร", "ความสำเร็จ; ความก้าวหน้า", "โลหะปราสาท", "สถาปัตยกรรม"),
    temple("วัดสระเกศ", "กรุงเทพมหานคร", "พระนคร", "เสริมดวง; สิริมงคล", "ภูเขาทอง", "เจดีย์"),
    temple("วัดบวรนิเวศวิหาร", "กรุงเทพมหานคร", "พระนคร", "ปฏิบัติธรรม; ความสงบ", "พระประธาน", "พระพุทธรูป"),
    temple("วัดชนะสงคราม", "กรุงเทพมหานคร", "พระนคร", "ชนะอุปสรรค; งาน", "พระประธาน", "พระพุทธรูป"),
    temple("วัดมหาธาตุยุวราชรังสฤษฎิ์", "กรุงเทพมหานคร", "พระนคร", "ปัญญา; ปฏิบัติธรรม", "พระบรมสารีริกธาตุ", "พระธาตุ"),
    temple("วัดระฆังโฆสิตาราม", "กรุงเทพมหานคร", "บางกอกน้อย", "ชื่อเสียง; ความโด่งดัง", "ระฆังใหญ่", "ระฆัง"),
    temple("วัดกัลยาณมิตร", "กรุงเทพมหานคร", "ธนบุรี", "มิตรไมตรี; ค้าขาย", "หลวงพ่อโต", "พระพุทธรูป"),
    temple("วัดอรุณ", "กรุงเทพมหานคร", "บางกอกใหญ่", "รุ่งโรจน์; สิริมงคล", "พระปรางค์วัดอรุณ", "พระปรางค์"),
    temple("วัดอมรินทราราม", "กรุงเทพมหานคร", "บางกอกน้อย", "สิริมงคล", "หลวงพ่อโบสถ์น้อย", "พระพุทธรูป"),
    temple("วัดคฤหบดี", "กรุงเทพมหานคร", "บางพลัด", "สิริมงคล", "พระประธาน", "พระพุทธรูป"),
    temple("วัดสุวรรณาราม", "กรุงเทพมหานคร", "บางกอกน้อย", "ปัญญา; การเรียน", "จิตรกรรมฝาผนัง", "จิตรกรรม"),
    temple("วัดไตรมิตรวิทยาราม", "กรุงเทพมหานคร", "สัมพันธวงศ์", "โชคลาภ; การเงิน", "พระทองคำ", "พระพุทธรูป"),
    temple("วัดยานนาวา", "กรุงเทพมหานคร", "สาทร", "ค้าขาย; เดินทางปลอดภัย", "เจดีย์เรือสำเภา", "เจดีย์"),
    temple("วัดปากน้ำภาษีเจริญ", "กรุงเทพมหานคร", "ภาษีเจริญ", "ปัญญา; ความสำเร็จ", "พระมหาเจดีย์มหารัชมงคล", "เจดีย์"),
]

BOAT_9 = [
    temple("วัดอรุณ", "กรุงเทพมหานคร", "บางกอกใหญ่", "รุ่งโรจน์; สิริมงคล", "พระปรางค์วัดอรุณ", "พระปรางค์"),
    temple("วัดกัลยาณมิตร", "กรุงเทพมหานคร", "ธนบุรี", "มิตรไมตรี; ค้าขาย", "หลวงพ่อโต", "พระพุทธรูป"),
    temple("วัดระฆังโฆสิตาราม", "กรุงเทพมหานคร", "บางกอกน้อย", "ชื่อเสียง; ความโด่งดัง", "ระฆังใหญ่", "ระฆัง"),
    temple("วัดอมรินทราราม", "กรุงเทพมหานคร", "บางกอกน้อย", "สิริมงคล", "หลวงพ่อโบสถ์น้อย", "พระพุทธรูป"),
    temple("วัดสุวรรณาราม", "กรุงเทพมหานคร", "บางกอกน้อย", "ปัญญา; ศิลปะ", "จิตรกรรมฝาผนัง", "จิตรกรรม"),
    temple("วัดคฤหบดี", "กรุงเทพมหานคร", "บางพลัด", "สิริมงคล", "พระประธาน", "พระพุทธรูป"),
    temple("วัดราชาธิวาส", "กรุงเทพมหานคร", "ดุสิต", "สิริมงคล", "หลวงพ่อเพชร", "พระพุทธรูป"),
    temple("วัดเทวราชกุญชร", "กรุงเทพมหานคร", "ดุสิต", "สิริมงคล", "หลวงพ่อโต", "พระพุทธรูป"),
    temple("วัดยานนาวา", "กรุงเทพมหานคร", "สาทร", "ค้าขาย; เดินทางปลอดภัย", "เจดีย์เรือสำเภา", "เจดีย์"),
]

PHUKET_9 = [
    temple("วัดพระใหญ่ ภูเก็ต", "ภูเก็ต", "เมืองภูเก็ต", "สิริมงคล", "พระพุทธมิ่งมงคลเอกนาคคีรี", "พระพุทธรูป"),
    temple("วัดไชยธาราราม", "ภูเก็ต", "เมืองภูเก็ต", "สิริมงคล; คุ้มครอง", "หลวงพ่อแซม", "พระเกจิ"),
    temple("วัดศรีสุนทร", "ภูเก็ต", "ถลาง", "สิริมงคล", "พระนอน", "พระพุทธรูป"),
    temple("วัดพระทอง", "ภูเก็ต", "ถลาง", "สิริมงคล; ปาฏิหาริย์", "พระผุด", "พระพุทธรูป"),
    temple("วัดม่วงโกมารภัจจ์", "ภูเก็ต", "ถลาง", "คุ้มครอง; ความกล้า", "ประวัติศาสตร์ศึกถลาง", "โบราณสถาน"),
    temple("วัดพระนางสร้าง", "ภูเก็ต", "ถลาง", "สิริมงคล", "พระพุทธรูปดีบุก", "พระพุทธรูป"),
    temple("วัดบ้านเกาะสิเหร่", "ภูเก็ต", "เมืองภูเก็ต", "สิริมงคล", "พระพุทธไสยาสน์", "พระพุทธรูป"),
    temple("วัดเขารังสามัคคีธรรม", "ภูเก็ต", "เมืองภูเก็ต", "ปฏิบัติธรรม; ความสงบ", "พระพุทธรูปสีทอง", "พระพุทธรูป"),
    temple("วัดมงคลนิมิตร", "ภูเก็ต", "เมืองภูเก็ต", "สิริมงคล", "พระอุโบสถ", "สถาปัตยกรรม"),
]

SONGKHLA_9 = [
    temple("วัดมหัตตมังคลาราม", "สงขลา", "หาดใหญ่", "สิริมงคล; ขอพร", "พระพุทธมหัตตมงคล", "พระนอน"),
    temple("วัดฉือฉาง", "สงขลา", "หาดใหญ่", "เทพจีน; เมตตา; คุ้มครอง", "เจ้าแม่กวนอิม", "เทพจีน", "วัดจีน", tags="วัดจีน; สายมู; ขอพร"),
    temple("วัดหัวถนน", "สงขลา", "หาดใหญ่", "สิริมงคล", "พระบรมสารีริกธาตุ", "พระธาตุ"),
    temple("วัดเขารูปช้าง", "สงขลา", "เมืองสงขลา", "สิริมงคล; เมตตา", "พระอวโลกิเตศวร", "โพธิสัตว์"),
    temple("วัดพะโคะ", "สงขลา", "สทิงพระ", "สิริมงคล; ศรัทธาหลวงพ่อทวด", "พระบรมธาตุ", "พระธาตุ"),
    temple("วัดมัชฌิมาวาส", "สงขลา", "เมืองสงขลา", "สิริมงคล; ศิลปวัฒนธรรม", "จิตรกรรมฝาผนัง", "จิตรกรรม"),
    temple("วัดแหลมพ้อ", "สงขลา", "เมืองสงขลา", "สิริมงคล", "พระนอน", "พระพุทธรูป"),
    temple("วัดพระมหาเจดีย์ไตรภพไตรมงคล", "สงขลา", "หาดใหญ่", "สิริมงคล", "พระมหาเจดีย์ไตรภพไตรมงคล", "เจดีย์"),
    temple("วัดเจดีย์งาม", "สงขลา", "ระโนด", "ขอพร; ความสำเร็จ", "หลวงปู่ช่วย", "พระเกจิ"),
]

LAMPANG_9 = [
    temple("วัดพระธาตุลำปางหลวง", "ลำปาง", "เกาะคา", "สิริมงคล; พระธาตุประจำปีฉลู", "พระธาตุลำปางหลวง", "พระธาตุ"),
    temple("วัดพระแก้วดอนเต้าสุชาดาราม", "ลำปาง", "เมืองลำปาง", "สิริมงคล", "พระธาตุดอนเต้า", "พระธาตุ"),
    temple("วัดศรีรองเมือง", "ลำปาง", "เมืองลำปาง", "สิริมงคล", "วิหารพม่า", "สถาปัตยกรรม"),
    temple("วัดพระธาตุจอมปิง", "ลำปาง", "เกาะคา", "สิริมงคล", "พระธาตุจอมปิง", "พระธาตุ"),
    temple("วัดพระธาตุเสด็จ", "ลำปาง", "เมืองลำปาง", "สิริมงคล", "พระธาตุเสด็จ", "พระธาตุ"),
    temple("วัดเจดีย์ซาวหลัง", "ลำปาง", "เมืองลำปาง", "สิริมงคล", "เจดีย์ซาวหลัง", "เจดีย์"),
    temple("วัดเฉลิมพระเกียรติพระจอมเกล้าราชานุสรณ์", "ลำปาง", "แจ้ห่ม", "สิริมงคล", "เจดีย์บนยอดเขา", "เจดีย์"),
    temple("วัดเสลารัตนปัพพตาราม", "ลำปาง", "เกาะคา", "สิริมงคล", "วิหารล้านนา", "สถาปัตยกรรม"),
    temple("วัดอักโขชัยคีรี", "ลำปาง", "แจ้ห่ม", "สิริมงคล", "เงาสะท้อนพระธาตุ", "พระธาตุ"),
]

NAN_9 = [
    temple("วัดพระธาตุแช่แห้ง", "น่าน", "ภูเพียง", "สิริมงคล; พระธาตุประจำปีเถาะ", "พระธาตุแช่แห้ง", "พระธาตุ"),
    temple("วัดพระธาตุเขาน้อย", "น่าน", "เมืองน่าน", "สิริมงคล", "พระธาตุเขาน้อย", "พระธาตุ"),
    temple("วัดภูมินทร์", "น่าน", "เมืองน่าน", "สิริมงคล; ศิลปวัฒนธรรม", "ปู่ม่านย่าม่าน", "จิตรกรรม"),
    temple("วัดพญาวัด", "น่าน", "เมืองน่าน", "ขอฝน; สิริมงคล", "พระเจ้าสายฝน", "พระพุทธรูป"),
    temple("วัดมิ่งเมือง", "น่าน", "เมืองน่าน", "หลักเมือง; สิริมงคล", "เสาหลักเมืองน่าน", "ศาลหลักเมือง"),
    temple("วัดศรีพันต้น", "น่าน", "เมืองน่าน", "สิริมงคล", "พระอุโบสถสีทอง", "สถาปัตยกรรม"),
    temple("วัดพระธาตุช้างค้ำวรวิหาร", "น่าน", "เมืองน่าน", "อุดหนุนค้ำจุน; สิริมงคล", "พระธาตุช้างค้ำ", "พระธาตุ"),
    temple("วัดหนองบัว", "น่าน", "ท่าวังผา", "สิริมงคล; ศิลปวัฒนธรรม", "จิตรกรรมไทลื้อ", "จิตรกรรม"),
    temple("วัดศรีมงคล", "น่าน", "ท่าวังผา", "สิริมงคล", "วิวท้องนาน่าน", "สถาปัตยกรรม"),
]

UBON_10 = [
    temple("วัดสิรินธรวรารามภูพร้าว", "อุบลราชธานี", "สิรินธร", "สิริมงคล", "ต้นไม้เรืองแสง", "จิตรกรรม"),
    temple("วัดพระธาตุหนองบัว", "อุบลราชธานี", "เมืองอุบลราชธานี", "สิริมงคล", "พระธาตุหนองบัว", "พระธาตุ"),
    temple("วัดถ้ำคูหาสวรรค์", "อุบลราชธานี", "โขงเจียม", "สิริมงคล; ศรัทธาหลวงปู่", "ฆ้องยักษ์", "โบราณสถาน"),
    temple("วัดทุ่งศรีเมือง", "อุบลราชธานี", "เมืองอุบลราชธานี", "สิริมงคล; ศิลปวัฒนธรรม", "หอไตรกลางน้ำ", "สถาปัตยกรรม"),
    temple("วัดบ้านนาเมือง", "อุบลราชธานี", "เมืองอุบลราชธานี", "สิริมงคล", "โบสถ์เรือสุพรรณหงส์", "สถาปัตยกรรม"),
    temple("วัดมหาวนาราม", "อุบลราชธานี", "เมืองอุบลราชธานี", "สิริมงคล", "พระเจ้าใหญ่อินทร์แปลง", "พระพุทธรูป"),
    temple("วัดหนองป่าพง", "อุบลราชธานี", "วารินชำราบ", "ปฏิบัติธรรม; ความสงบ", "เจดีย์หลวงปู่ชา", "เจดีย์"),
    temple("วัดแจ้ง", "อุบลราชธานี", "เมืองอุบลราชธานี", "สิริมงคล; ศิลปวัฒนธรรม", "พระอุโบสถโบราณ", "สถาปัตยกรรม"),
    temple("วัดถ้ำเหวสินธุ์ชัย", "อุบลราชธานี", "โขงเจียม", "สิริมงคล", "ถ้ำ", "ถ้ำ"),
    temple("วัดป่าสว่างวีระวงศ์", "อุบลราชธานี", "สว่างวีระวงศ์", "ปฏิบัติธรรม; ความสงบ", "สำนักปฏิบัติธรรม", "วัดป่า"),
]

RAYONG_15 = [
    temple("วัดป่าประดู่", "ระยอง", "เมืองระยอง", "สิริมงคล", "พระพุทธไสยาสน์ตะแคงซ้าย", "พระนอน"),
    temple("วัดท่ามะกอก", "ระยอง", "แกลง", "สิริมงคล", "พระอุโบสถ", "สถาปัตยกรรม"),
    temple("วัดบ้านแลง", "ระยอง", "เมืองระยอง", "สิริมงคล", "พระอุโบสถ", "สถาปัตยกรรม"),
    temple("วัดถ้ำเขาประทุน", "ระยอง", "เขาชะเมา", "โชคลาภ; พญานาค", "ถ้ำเขาประทุน", "ถ้ำ", tags="พญานาค; สายมู; โชคลาภ"),
    temple("พระเจดีย์กลางน้ำ", "ระยอง", "เมืองระยอง", "สิริมงคล", "พระเจดีย์กลางน้ำ", "เจดีย์", "เจดีย์"),
    temple("วัดปลวกเกตุ", "ระยอง", "เมืองระยอง", "ท้าวเวสสุวรรณ; สะเดาะเคราะห์", "ท้าวเวสสุวรรณ", "ท้าวเวสสุวรรณ", tags="ท้าวเวสสุวรรณ; สายมู; สะเดาะเคราะห์"),
    temple("วัดละหารไร่", "ระยอง", "บ้านค่าย", "สิริมงคล; พระเกจิ", "หลวงปู่ทิม", "พระเกจิ"),
    temple("วัดหนองกรับ", "ระยอง", "บ้านค่าย", "สิริมงคล; พระเกจิ", "หลวงพ่อสาคร", "พระเกจิ"),
    temple("วัดพลงไสว", "ระยอง", "แกลง", "สิริมงคล", "พระพุทธรูปยืน", "พระพุทธรูป"),
    temple("วัดน้ำตกธรรมรส", "ระยอง", "วังจันทร์", "ปฏิบัติธรรม; ความสงบ", "พระพุทธรูปปางพระเจ้าเปิดโลก", "พระพุทธรูป"),
    temple("วัดสารนารถธรรมาราม", "ระยอง", "แกลง", "สิริมงคล", "พระบรมสารีริกธาตุ", "พระธาตุ"),
    temple("วัดราชบัลลังก์ประดิษฐาราม", "ระยอง", "แกลง", "สิริมงคล", "พระบรมสารีริกธาตุ", "พระธาตุ"),
    temple("วัดบ้านนา", "ระยอง", "แกลง", "สิริมงคล; พระเกจิ", "หลวงปู่บุญ", "พระเกจิ"),
    temple("วัดตะเคียนทอง", "ระยอง", "แกลง", "สิริมงคล", "โบราณสถาน", "โบราณสถาน"),
    temple("วัดปิปผลิวนาราม", "ระยอง", "บ้านค่าย", "สิริมงคล", "พระอุโบสถ", "สถาปัตยกรรม"),
]

KHONKAEN_9 = [
    temple("พระธาตุขามแก่น", "ขอนแก่น", "น้ำพอง", "สิริมงคล", "พระธาตุขามแก่น", "พระธาตุ"),
    temple("วัดกู่ประภาชัย", "ขอนแก่น", "น้ำพอง", "สุขภาพ; คุ้มครอง", "กู่ประภาชัย", "โบราณสถาน"),
    temple("วัดหนองแวง", "ขอนแก่น", "เมืองขอนแก่น", "งาน; สิริมงคล", "พระมหาธาตุแก่นนคร", "พระธาตุ"),
    temple("วัดธาตุ", "ขอนแก่น", "เมืองขอนแก่น", "ความร่มเย็น", "พระธาตุ", "พระธาตุ"),
    temple("วัดป่าแสงอรุณ", "ขอนแก่น", "เมืองขอนแก่น", "สิริมงคล; ศิลปวัฒนธรรม", "สิมอีสาน", "สถาปัตยกรรม"),
    temple("วัดไชยศรี", "ขอนแก่น", "เมืองขอนแก่น", "สิริมงคล; ศิลปวัฒนธรรม", "ฮูปแต้มสินไซ", "จิตรกรรม"),
    temple("วัดทุ่งเศรษฐี", "ขอนแก่น", "เมืองขอนแก่น", "โชคลาภ; ทรัพย์", "มหาเจดีย์รัตนะ", "เจดีย์", tags="สายมู; โชคลาภ; ขอพร"),
    temple("วัดพระพุทธบาทภูพานคำ", "ขอนแก่น", "อุบลรัตน์", "สิริมงคล", "พระพุทธบาท", "รอยพระพุทธบาท"),
    temple("วัดถ้ำผาเกิ้ง", "ขอนแก่น", "เวียงเก่า", "สิริมงคล", "พระพุทธไสยาสน์", "พระพุทธรูป"),
]

AYUTTHAYA_9 = [
    temple("วัดใหญ่ชัยมงคล", "พระนครศรีอยุธยา", "พระนครศรีอยุธยา", "ชัยชนะ; การงาน", "เจดีย์ชัยมงคล", "เจดีย์"),
    temple("วัดพนัญเชิง", "พระนครศรีอยุธยา", "พระนครศรีอยุธยา", "ค้าขาย; เมตตา", "หลวงพ่อโต", "พระพุทธรูป"),
    temple("วัดพุทไธศวรรย์", "พระนครศรีอยุธยา", "พระนครศรีอยุธยา", "คุ้มครอง; โบราณสถาน", "ปรางค์ประธาน", "พระปรางค์"),
    temple("วัดไชยวัฒนาราม", "พระนครศรีอยุธยา", "พระนครศรีอยุธยา", "สิริมงคล; โบราณสถาน", "ปรางค์ประธาน", "พระปรางค์"),
    temple("วัดโลกยสุธาราม", "พระนครศรีอยุธยา", "พระนครศรีอยุธยา", "สิริมงคล", "พระนอน", "พระพุทธรูป"),
    temple("วัดพระศรีสรรเพชญ์", "พระนครศรีอยุธยา", "พระนครศรีอยุธยา", "สิริมงคล", "เจดีย์ 3 องค์", "เจดีย์"),
    temple("วิหารพระมงคลบพิตร", "พระนครศรีอยุธยา", "พระนครศรีอยุธยา", "สิริมงคล", "พระมงคลบพิตร", "พระพุทธรูป", "วิหาร"),
    temple("วัดธรรมิกราช", "พระนครศรีอยุธยา", "พระนครศรีอยุธยา", "สุขภาพ", "วิหารสิงห์ล้อม", "โบราณสถาน"),
    temple("วัดหน้าพระเมรุ", "พระนครศรีอยุธยา", "พระนครศรีอยุธยา", "คุ้มครอง; แคล้วคลาด", "พระพุทธนิมิตวิชิตมาร", "พระพุทธรูป"),
]

CHONBURI_ROUTE_9 = [
    temple("วัดแสนสุขวิสุทธิวราราม", "ชลบุรี", "เมืองชลบุรี", "สิริมงคล", "แดนนรก-สวรรค์", "ประติมากรรม"),
    temple("วัดใหญ่อินทาราม", "ชลบุรี", "เมืองชลบุรี", "สิริมงคล", "พระอุโบสถ", "สถาปัตยกรรม"),
    temple("วิหารเทพสถิตพระกิติเฉลิม", "ชลบุรี", "เมืองชลบุรี", "เทพจีน; ค้าขาย; คุ้มครอง", "องค์เทพนาจา", "เทพจีน", "ศาลเจ้า", tags="วัดจีน; สายมู; ขอพร"),
    temple("สำนักสงฆ์เขาพระครู", "ชลบุรี", "ศรีราชา", "สิริมงคล; วิวเมือง", "พระพุทธรูปบนยอดเขา", "พระพุทธรูป", "สำนักสงฆ์"),
    temple("วัดเขาตะแบก", "ชลบุรี", "ศรีราชา", "สิริมงคล", "สกายวอล์ก", "จุดชมวิว"),
    temple("วัดเกาะลอย", "ชลบุรี", "ศรีราชา", "สิริมงคล", "วิหารกลางทะเล", "สถาปัตยกรรม"),
    temple("วัดญาณสังวราราม", "ชลบุรี", "สัตหีบ", "สิริมงคล; ปฏิบัติธรรม", "พระบรมธาตุเจดีย์มหาจักรีพิพัฒน์", "เจดีย์"),
    temple("วัดพระใหญ่ พัทยา", "ชลบุรี", "บางละมุง", "สิริมงคล", "พระพุทธสุโขทัยวลัยชลธาร", "พระพุทธรูป"),
    temple("วัดหลวงพี่แซม", "ชลบุรี", "พนัสนิคม", "โชคลาภ; พญานาค", "ถ้ำลอดมหาจักรพรรดิ์", "พญานาค", tags="พญานาค; สายมู; โชคลาภ"),
]

CHIANGKHAN_9 = [
    temple("วัดศรีคุณเมือง", "เลย", "เชียงคาน", "สิริมงคล", "พระประธานล้านช้าง", "พระพุทธรูป"),
    temple("วัดมหาธาตุ เชียงคาน", "เลย", "เชียงคาน", "สิริมงคล", "พระธาตุ", "พระธาตุ"),
    temple("วัดท่าคก", "เลย", "เชียงคาน", "สิริมงคล", "ศิลปะล้านช้าง", "สถาปัตยกรรม"),
    temple("วัดป่าใต้", "เลย", "เชียงคาน", "สิริมงคล", "วิหารล้านช้าง", "สถาปัตยกรรม"),
    temple("วัดท่าแขก", "เลย", "เชียงคาน", "สิริมงคล", "พระอุโบสถ", "สถาปัตยกรรม"),
    temple("วัดพระพุทธบาทภูควายเงิน", "เลย", "เชียงคาน", "โชคลาภ; ขอพร", "รอยพระพุทธบาท", "รอยพระพุทธบาท"),
    temple("วัดสันติวนาราม", "เลย", "เชียงคาน", "ปฏิบัติธรรม; ความสงบ", "วัดป่า", "วัดป่า"),
    temple("วัดภูช้างน้อย", "เลย", "เชียงคาน", "สิริมงคล", "จุดชมวิว", "จุดชมวิว"),
    temple("วัดโพนชัย", "เลย", "เชียงคาน", "สิริมงคล", "พระอุโบสถ", "สถาปัตยกรรม"),
]


SOURCES = [
    src(
        "TRAVELOKA_BKK19_2026",
        "Traveloka",
        "บทความ/blog",
        "กรุงเทพฯ 19 วัดดังสายมู",
        "https://www.traveloka.com/th-th/explore/destination/temples-day-trip-bkk/258661",
        "Traveloka: 19 วัดดังในกรุงเทพฯ สำหรับสายมู",
        BKK_19,
        ["popular", "mu"],
        travel_mode="เดิน; BTS/MRT; เรือ; แท็กซี่; รถเช่า",
        confidence="high",
    ),
    src(
        "TRAVELOKA_BKK9_2026",
        "Traveloka",
        "บทความ/blog",
        "กรุงเทพฯ ไหว้พระ 9 วัด",
        "https://www.traveloka.com/th-th/explore/destination/9-temples-day-trip-bkk/236120",
        "Traveloka: ไหว้พระ 9 วัดดังในกรุงเทพฯ",
        BKK_CORE_9,
        ["popular", "mu"],
        travel_mode="เดิน; BTS/MRT; เรือ; แท็กซี่",
        confidence="high",
    ),
    src(
        "TRAVELOKA_BKK_BOAT9",
        "Traveloka",
        "บทความ/blog",
        "กรุงเทพฯ ล่องเรือไหว้พระ 9 วัด",
        "https://www.traveloka.com/th-th/explore/destination/9-temples-boat-trip/349577",
        "Traveloka: ล่องเรือไหว้พระ 9 วัดริมเจ้าพระยา",
        BOAT_9,
        ["popular", "sacred"],
        travel_mode="BTS; เรือด่วนเจ้าพระยา; เดิน",
        route_type="เส้นทางล่องเรือ/One Day Trip",
        confidence="high",
    ),
    src(
        "TRAVELOKA_PHUKET9_2026",
        "Traveloka",
        "บทความ/blog",
        "ภูเก็ต ไหว้พระ 9 วัด",
        "https://www.traveloka.com/th-th/explore/destination/trip-9-temples-in-phuket/431027",
        "Traveloka: ทริปไหว้พระ 9 วัดในภูเก็ต",
        PHUKET_9,
        ["popular", "sacred"],
        travel_mode="เครื่องบิน; รถเช่า; รถส่วนตัว; แท็กซี่",
        confidence="high",
    ),
    src(
        "TRAVELOKA_SONGKHLA9_2026",
        "Traveloka",
        "บทความ/blog",
        "สงขลา 9 วัดสายบุญ",
        "https://www.traveloka.com/th-th/explore/destination/songkla-temples/368333",
        "Traveloka: 9 วัดสวยในสงขลา",
        SONGKHLA_9,
        ["popular", "sacred"],
        travel_mode="เครื่องบิน; รถเช่า; รถส่วนตัว; แท็กซี่",
        confidence="high",
    ),
    src(
        "TRAVELOKA_LAMPANG9_2026",
        "Traveloka",
        "บทความ/blog",
        "ลำปาง ไหว้พระ 9 วัด",
        "https://www.traveloka.com/th-th/explore/destination/9-temples-in-lampang-trip/431031",
        "Traveloka: ไหว้พระ 9 วัดลำปางใน 1 วัน",
        LAMPANG_9,
        ["popular", "sacred"],
        travel_mode="เครื่องบิน; รถเช่า; รถส่วนตัว",
        confidence="high",
    ),
    src(
        "TRAVELOKA_NAN9",
        "Traveloka",
        "บทความ/blog",
        "น่าน ไหว้พระ 9 วัด",
        "https://www.traveloka.com/th-th/explore/destination/nan-temple-buddha/51797",
        "Traveloka: เที่ยวน่านไหว้พระ 9 วัด",
        NAN_9,
        ["popular", "sacred"],
        travel_mode="เครื่องบิน; รถเช่า; รถส่วนตัว",
        confidence="high",
    ),
    src(
        "TRAVELOKA_UBON10",
        "Traveloka",
        "บทความ/blog",
        "อุบลราชธานี 10 วัดน่าเที่ยว",
        "https://www.traveloka.com/th-th/explore/destination/ubon-ratchathani-temple/51792",
        "Traveloka: 10 วัดน่าเที่ยวอุบลราชธานี",
        UBON_10,
        ["sacred"],
        route_duration="ตามแผนเที่ยว",
        travel_mode="เครื่องบิน; รถเช่า; รถส่วนตัว",
        confidence="medium-high",
    ),
    src(
        "TRIP_RAYONG15_2026",
        "Trip.com",
        "บทความ/blog",
        "ระยอง 15 วัดศักดิ์สิทธิ์",
        "https://th.trip.com/guide/attraction/temples+in+rayong.html",
        "Trip.com: 15 วัดในระยองที่ต้องไปเยือน",
        RAYONG_15,
        ["sacred"],
        route_duration="ตามแผนเที่ยว",
        travel_mode="รถส่วนตัว; รถโดยสาร; รถตู้; เครื่องบินอู่ตะเภา",
        confidence="high",
    ),
    src(
        "TRIP_RAYONG_MU_2026",
        "Trip.com",
        "บทความ/blog",
        "ระยอง วัดสายมูเฉพาะจุด",
        "https://th.trip.com/guide/attraction/temples+in+rayong.html",
        "Trip.com: วัดระยองที่มีบริบทสายมู",
        [RAYONG_15[3], RAYONG_15[5], RAYONG_15[6], RAYONG_15[7]],
        ["mu"],
        route_duration="ตามแผนเที่ยว",
        travel_mode="รถส่วนตัว; รถโดยสาร; รถตู้",
        confidence="medium-high",
    ),
    src(
        "TRIP_KHONKAEN9_2026",
        "Trip.com",
        "บทความ/blog",
        "ขอนแก่น แพลนไหว้พระ 9 วัด",
        "https://th.trip.com/guide/destination/%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B9%83%E0%B8%99%E0%B8%82%E0%B8%AD%E0%B8%99%E0%B9%81%E0%B8%81%E0%B9%88%E0%B8%99.html",
        "Trip.com: แพลนไหว้พระ 9 วัดขอนแก่น",
        KHONKAEN_9,
        ["popular", "sacred"],
        travel_mode="รถเช่า; รถส่วนตัว; ขอนแก่นซิตี้บัส; Grab/Bolt; รถสองแถว",
        confidence="high",
    ),
    src(
        "TRIP_KHONKAEN_MU_2026",
        "Trip.com",
        "บทความ/blog",
        "ขอนแก่น วัดสายมู",
        "https://th.trip.com/guide/destination/%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B9%83%E0%B8%99%E0%B8%82%E0%B8%AD%E0%B8%99%E0%B9%81%E0%B8%81%E0%B9%88%E0%B8%99.html",
        "Trip.com: 10 วัดขอนแก่นสายมู",
        [KHONKAEN_9[0], KHONKAEN_9[1], KHONKAEN_9[2], KHONKAEN_9[6], KHONKAEN_9[7]],
        ["mu"],
        travel_mode="รถเช่า; รถส่วนตัว; ขนส่งท้องถิ่น",
        confidence="high",
    ),
    src(
        "TRIP_BKK10_2026",
        "Trip.com",
        "บทความ/blog",
        "กรุงเทพฯ วัดทำบุญพร้อมวิธีเดินทาง",
        "https://th.trip.com/guide/attraction/temples-in-bangkok.html",
        "Trip.com: 10 วัดสวยในกรุงเทพฯ สำหรับไหว้พระทำบุญ",
        BKK_CORE_9 + [temple("วัดบวรนิเวศวิหาร", "กรุงเทพมหานคร", "พระนคร", "ปฏิบัติธรรม; ความสงบ", "พระประธาน", "พระพุทธรูป")],
        ["popular", "sacred"],
        travel_mode="เดิน; BTS/MRT; เรือ; รถประจำทาง; แท็กซี่",
        confidence="high",
    ),
    src(
        "TRIP_AYUTTHAYA9_2026",
        "Trip.com",
        "บทความ/blog",
        "อยุธยา ไหว้พระ 9 วัดสายมู",
        "https://th.trip.com/guide/activity/ayutthaya-temple-visit.html",
        "Trip.com: ไหว้พระอยุธยา 9 วัด มูให้ปัง",
        AYUTTHAYA_9,
        ["popular", "mu", "sacred"],
        travel_mode="รถส่วนตัว; รถเช่า; เหมารถตุ๊กตุ๊ก; รถตู้",
        confidence="high",
    ),
    src(
        "TRIP_CHONBURI9_2026",
        "Trip.com",
        "บทความ/blog",
        "ชลบุรี วางแผนทริปไหว้พระ",
        "https://th.trip.com/guide/destination/temples-in-chonburi.html",
        "Trip.com: วัดชลบุรีพร้อมแผนที่และทริปไหว้พระ",
        CHONBURI_ROUTE_9,
        ["popular", "sacred"],
        route_duration="1-2 วัน",
        travel_mode="รถส่วนตัว; รถเช่า; รถสาธารณะท้องถิ่น",
        confidence="high",
    ),
    src(
        "TRIP_CHONBURI_MU_2026",
        "Trip.com",
        "บทความ/blog",
        "ชลบุรี จุดขอพรสายมู",
        "https://th.trip.com/guide/destination/temples-in-chonburi.html",
        "Trip.com: วัดชลบุรีที่มีบริบทสายมู",
        [CHONBURI_ROUTE_9[2], CHONBURI_ROUTE_9[7], CHONBURI_ROUTE_9[8], temple("วัดหนองจับเต่า", "ชลบุรี", "สัตหีบ", "สุขภาพ; อายุยืน", "พญาเต่า", "สัตว์มงคล", tags="สายมู; สุขภาพ; ขอพร")],
        ["mu"],
        route_duration="1-2 วัน",
        travel_mode="รถส่วนตัว; รถเช่า",
        confidence="medium-high",
    ),
    src(
        "TRIP_CHIANGKHAN9_2026",
        "Trip.com",
        "บทความ/blog",
        "เชียงคาน ไหว้พระ 9 วัด",
        "https://th.trip.com/guide/attraction/temples-in-chiang-khan.html",
        "Trip.com: 9 วัดในเชียงคาน ไหว้พระขอพร",
        CHIANGKHAN_9,
        ["popular", "mu", "sacred"],
        travel_mode="เดิน; จักรยาน; รถส่วนตัว; รถเช่า",
        confidence="high",
    ),
]


def read_sheet(ws):
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return [], []
    headers = [clean(h) for h in rows[0]]
    data = []
    for raw in rows[1:]:
        if raw and any(cell is not None and clean(cell) for cell in raw):
            data.append({headers[index]: raw[index] if index < len(raw) else "" for index in range(len(headers))})
    return headers, data


def write_sheet(wb, sheet_name, headers, rows):
    if sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        template_row = 2 if ws.max_row and ws.max_row >= 2 else 1
        template_cells = [copy(ws.cell(template_row, col)._style) for col in range(1, len(headers) + 1)]
        widths = {col: ws.column_dimensions[col].width for col in ws.column_dimensions}
        ws.delete_rows(1, ws.max_row or 1)
    else:
        ws = wb.create_sheet(sheet_name)
        template_cells = []
        widths = {}

    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="3F3732")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for row in rows:
        ws.append([row.get(header, "") for header in headers])

    for row_idx in range(2, ws.max_row + 1):
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row_idx, col_idx)
            if template_cells:
                cell._style = copy(template_cells[col_idx - 1])
            cell.alignment = Alignment(vertical="top", wrap_text=True)

    for idx, header in enumerate(headers, start=1):
        letter = ws.cell(1, idx).column_letter
        current_width = widths.get(letter)
        sample_values = [clean(header)] + [clean(row.get(header, "")) for row in rows[:250]]
        max_len = max((len(value) for value in sample_values), default=10)
        width = min(max(max_len * 1.05, 10), 42)
        if header in {"routeName", "packageName", "templeNamesInOrder", "normalizedTempleNamesInOrder", "templeMasterKeysInOrder", "routeRowIds", "sourceUrl", "sourceUrls"}:
            width = 38
        elif header in {"sourceKeys", "routeNames", "blessingCategories", "objectHero", "tourCompanies"}:
            width = 28
        elif header in {"no", "globalRank", "templeSequence", "templeCount"}:
            width = 8
        ws.column_dimensions[letter].width = current_width if current_width and current_width > width else width

    ws.freeze_panes = "A2"
    return ws


def next_no(rows):
    numbers = [int(row.get("no") or 0) for row in rows if str(row.get("no") or "").isdigit()]
    return max(numbers or [0]) + 1


def existing_place_lookup(all_category_data):
    lookup = {}
    for data in all_category_data.values():
        for row in data.get("Temple_Master", []):
            name = clean(row.get("templeName"))
            province = clean(row.get("province"))
            if name and province:
                lookup[(normalize_name(name, province), province)] = {
                    "district": clean(row.get("districtArea")),
                    "region": clean(row.get("region")),
                    "placeType": clean(row.get("placeType")),
                }
    return lookup


def merge_existing_temple(temple_row, lookup):
    match = lookup.get((temple_row["name"], temple_row["province"]))
    if not match:
        return temple_row
    merged = dict(temple_row)
    for key in ["district", "region", "placeType"]:
        if match.get(key) and not merged.get(key):
            merged[key] = match[key]
    return merged


def build_added_rows(category, sources, existing_rows, lookup):
    existing_keys = {
        (clean(row.get("sourceKey")), clean(row.get("templeMasterKey")))
        for row in existing_rows
        if clean(row.get("sourceKey")) and clean(row.get("templeMasterKey"))
    }
    added = []
    no = next_no(existing_rows)
    for source in sources:
        if category not in source["categories"]:
            continue
        route_id = f"{source['key']}_ROUTE"
        category_temples = [merge_existing_temple(item, lookup) for item in source["temples"]]
        for sequence, item in enumerate(category_temples, start=1):
            temple_key = item["key"]
            if (source["key"], temple_key) in existing_keys:
                continue
            route_row_id = f"{source['key']}_{sequence:02d}"
            added.append(
                {
                    "no": no,
                    "routeRowId": route_row_id,
                    "routeId": route_id,
                    "templeMasterKey": temple_key,
                    "templeName": item["name"],
                    "normalizedTempleName": item["name"],
                    "placeType": item["placeType"],
                    "region": item["region"] or REGION_BY_PROVINCE.get(item["province"], ""),
                    "province": item["province"],
                    "districtArea": item["district"],
                    "routeName": source["routeName"],
                    "routeScope": source["routeScope"],
                    "routeDuration": source["routeDuration"],
                    "templeSequence": sequence,
                    "blessingPrimary": item["blessingPrimary"],
                    "blessingCategories": item["blessingCategories"],
                    "objectHero": item["objectHero"],
                    "objectHeroType": item["objectHeroType"],
                    "deitySacredObject": item["deitySacredObject"],
                    "templeStyleTags": item["templeStyleTags"],
                    "travelMode": source["travelMode"],
                    "routeType": source["routeType"],
                    "tourCompany": source["tourCompany"],
                    "packageName": source["packageName"],
                    "packageType": source["packageType"],
                    "packagePrice": source["packagePrice"],
                    "sourceKey": source["key"],
                    "sourceName": source["sourceName"],
                    "sourceType": source["sourceType"],
                    "sourceScope": source["scope"],
                    "sourceConfidence": source["confidence"],
                }
            )
            no += 1
            existing_keys.add((source["key"], temple_key))
    return added


def canonicalize_route_rows(route_rows):
    for row in route_rows:
        province = clean(row.get("province"))
        name = clean(row.get("templeName"))
        canonical = normalize_name(name, province)
        if canonical and province:
            row["templeMasterKey"] = key_for(canonical, province)
            row["templeName"] = canonical
            row["normalizedTempleName"] = canonical
        if not clean(row.get("region")) and province:
            row["region"] = REGION_BY_PROVINCE.get(province, "")
    return route_rows


def recompute_master(route_rows):
    groups = {}
    first_seen = {}
    for index, row in enumerate(route_rows):
        key = clean(row.get("templeMasterKey"))
        if not key:
            continue
        first_seen.setdefault(key, index)
        group = groups.setdefault(
            key,
            {
                "templeMasterKey": key,
                "templeName": clean(row.get("templeName")),
                "placeType": clean(row.get("placeType")),
                "region": clean(row.get("region")),
                "province": clean(row.get("province")),
                "districtArea": clean(row.get("districtArea")),
                "occurrenceCount": 0,
                "blessingCategories": [],
                "objectHero": [],
                "objectHeroType": [],
                "travelModes": [],
                "routeNames": [],
                "tourCompanies": [],
                "sourceKeys": [],
                "sourceTypes": [],
            },
        )
        group["occurrenceCount"] += 1
        for field, target in [
            ("blessingCategories", "blessingCategories"),
            ("objectHero", "objectHero"),
            ("objectHeroType", "objectHeroType"),
            ("travelMode", "travelModes"),
            ("routeName", "routeNames"),
            ("tourCompany", "tourCompanies"),
            ("sourceKey", "sourceKeys"),
            ("sourceType", "sourceTypes"),
        ]:
            value = clean(row.get(field))
            if value:
                group[target].append(value)
        for field in ["templeName", "placeType", "region", "province", "districtArea"]:
            if not group.get(field) and clean(row.get(field)):
                group[field] = clean(row.get(field))

    sorted_groups = sorted(
        groups.values(),
        key=lambda item: (
            -int(item["occurrenceCount"]),
            item["province"],
            first_seen.get(item["templeMasterKey"], 999999),
            item["templeName"],
        ),
    )
    rows = []
    for index, group in enumerate(sorted_groups, start=1):
        rows.append(
            {
                "no": index,
                "templeMasterKey": group["templeMasterKey"],
                "templeName": group["templeName"],
                "placeType": group["placeType"],
                "region": group["region"],
                "province": group["province"],
                "districtArea": group["districtArea"],
                "occurrenceCount": group["occurrenceCount"],
                "blessingCategories": join_unique(group["blessingCategories"]),
                "objectHero": join_unique(group["objectHero"]),
                "objectHeroType": join_unique(group["objectHeroType"]),
                "travelModes": join_unique(group["travelModes"]),
                "routeNames": join_unique(group["routeNames"]),
                "tourCompanies": join_unique(group["tourCompanies"]),
                "sourceKeys": join_unique(group["sourceKeys"]),
                "sourceTypes": join_unique(group["sourceTypes"]),
            }
        )
    return rows


def recompute_routes(route_rows):
    groups = defaultdict(list)
    for row in route_rows:
        groups[clean(row.get("routeId"))].append(row)
    route_packages = []
    route_temples = []
    for route_id, rows in groups.items():
        rows = sorted(rows, key=lambda row: int(row.get("templeSequence") or 9999))
        first = rows[0]
        route_packages.append(
            {
                "routeId": route_id,
                "sourceKey": clean(first.get("sourceKey")),
                "routeName": clean(first.get("routeName")),
                "routeScope": clean(first.get("routeScope")),
                "routeDuration": clean(first.get("routeDuration")),
                "travelMode": clean(first.get("travelMode")),
                "routeType": clean(first.get("routeType")),
                "tourCompany": clean(first.get("tourCompany")),
                "packageName": clean(first.get("packageName")),
                "packageType": clean(first.get("packageType")),
                "packagePrice": clean(first.get("packagePrice")),
                "templeCount": len(rows),
                "templeNamesInOrder": "; ".join(clean(row.get("templeName")) for row in rows),
                "normalizedTempleNamesInOrder": "; ".join(clean(row.get("normalizedTempleName")) for row in rows),
                "templeMasterKeysInOrder": "; ".join(clean(row.get("templeMasterKey")) for row in rows),
                "routeRowIds": "; ".join(clean(row.get("routeRowId")) for row in rows),
                "provinces": join_unique(clean(row.get("province")) for row in rows),
                "blessingCategories": join_unique(clean(row.get("blessingCategories")) for row in rows),
            }
        )
        for row in rows:
            route_temples.append(
                {
                    "routeTempleId": f"{route_id}_{int(row.get('templeSequence') or 0):02d}",
                    "routeId": route_id,
                    "routeRowId": clean(row.get("routeRowId")),
                    "sourceKey": clean(row.get("sourceKey")),
                    "routeName": clean(row.get("routeName")),
                    "routeType": clean(row.get("routeType")),
                    "tourCompany": clean(row.get("tourCompany")),
                    "packageName": clean(row.get("packageName")),
                    "packagePrice": clean(row.get("packagePrice")),
                    "templeSequence": row.get("templeSequence"),
                    "templeName": clean(row.get("templeName")),
                    "normalizedTempleName": clean(row.get("normalizedTempleName")),
                    "templeMasterKey": clean(row.get("templeMasterKey")),
                    "placeType": clean(row.get("placeType")),
                    "region": clean(row.get("region")),
                    "province": clean(row.get("province")),
                    "districtArea": clean(row.get("districtArea")),
                    "blessingPrimary": clean(row.get("blessingPrimary")),
                    "blessingCategories": clean(row.get("blessingCategories")),
                    "objectHero": clean(row.get("objectHero")),
                    "objectHeroType": clean(row.get("objectHeroType")),
                    "travelMode": clean(row.get("travelMode")),
                    "sourceConfidence": clean(row.get("sourceConfidence")),
                }
            )
    route_packages.sort(key=lambda row: (row["sourceKey"], row["routeName"]))
    return route_packages, route_temples


def update_sources(existing_sources, category):
    by_key = {clean(row.get("sourceKey")): row for row in existing_sources if clean(row.get("sourceKey"))}
    for source in SOURCES:
        if category not in source["categories"]:
            continue
        by_key[source["key"]] = {
            "sourceKey": source["key"],
            "sourceName": source["sourceName"],
            "sourceType": source["sourceType"],
            "scope": source["scope"],
            "sourceUrl": source["url"],
        }
    return list(by_key.values())


def update_summary(wb, category, master_rows, route_rows, source_rows):
    headers = ["metric", "value"]
    top = "; ".join(f"{row['templeName']} ({row['occurrenceCount']})" for row in master_rows[:15])
    rows = [
        {"metric": "category", "value": CATEGORY_LABELS[category]},
        {"metric": "updatedAt", "value": date.today().isoformat()},
        {"metric": "templeCount", "value": len(master_rows)},
        {"metric": "routeRowCount", "value": len(route_rows)},
        {"metric": "sourceCount", "value": len(source_rows)},
        {"metric": "topMentionedTemples", "value": top},
        {"metric": "latestAddedSources", "value": "; ".join(source["key"] for source in SOURCES if category in source["categories"])},
    ]
    write_sheet(wb, "Summary", headers, rows)


def load_all_category_data():
    data = {}
    for category, path in CATEGORY_FILES.items():
        wb = load_workbook(path)
        sheets = {}
        for sheet_name in wb.sheetnames:
            headers, rows = read_sheet(wb[sheet_name])
            sheets[sheet_name] = rows
            sheets[f"_{sheet_name}_headers"] = headers
        data[category] = sheets
    return data


def update_category_workbooks():
    all_data = load_all_category_data()
    lookup = existing_place_lookup(all_data)
    updated_data = {}
    for category, path in CATEGORY_FILES.items():
        wb = load_workbook(path)
        current = all_data[category]
        route_headers = current["_Temple_Route_Rows_headers"]
        route_rows = canonicalize_route_rows(current["Temple_Route_Rows"])
        route_rows.extend(build_added_rows(category, SOURCES, route_rows, lookup))

        master_rows = recompute_master(route_rows)
        route_packages, route_temples = recompute_routes(route_rows)
        source_rows = update_sources(current["Source_Index_No_URL"], category)

        write_sheet(wb, "Temple_Route_Rows", route_headers, route_rows)
        write_sheet(wb, "Temple_Master", current["_Temple_Master_headers"], master_rows)
        write_sheet(wb, "Routes_Packages", current["_Routes_Packages_headers"], route_packages)
        write_sheet(wb, "Route_Temples", current["_Route_Temples_headers"], route_temples)
        write_sheet(wb, "Source_Index_No_URL", current["_Source_Index_No_URL_headers"], source_rows)
        update_summary(wb, category, master_rows, route_rows, source_rows)
        wb.save(path)

        updated_data[category] = {
            "Temple_Route_Rows": route_rows,
            "Temple_Master": master_rows,
            "Source_Index_No_URL": source_rows,
        }
        print(f"Updated {path.name}: {len(master_rows)} temples, {len(route_rows)} rows, {len(source_rows)} sources")
    return updated_data


def recompute_global(updated_data):
    groups = {}
    category_rows = []
    source_urls = {}
    for category, data in updated_data.items():
        label = CATEGORY_LABELS[category]
        sources = {clean(row.get("sourceKey")): row for row in data["Source_Index_No_URL"]}
        for source in data["Source_Index_No_URL"]:
            source_urls[clean(source.get("sourceKey"))] = source
        master_by_key = {clean(row.get("templeMasterKey")): row for row in data["Temple_Master"]}
        for route in data["Temple_Route_Rows"]:
            key = clean(route.get("templeMasterKey"))
            if not key:
                continue
            source_key = clean(route.get("sourceKey"))
            master = master_by_key.get(key, {})
            group = groups.setdefault(
                key,
                {
                    "templeMasterKey": key,
                    "templeName": clean(route.get("templeName")),
                    "province": clean(route.get("province")),
                    "region": clean(route.get("region")),
                    "districtArea": clean(route.get("districtArea")),
                    "placeType": clean(route.get("placeType")),
                    "popularMentions": 0,
                    "muMentions": 0,
                    "sacredMentions": 0,
                    "sourceKeys": [],
                    "sourceUrls": [],
                    "categoryMembership": [],
                    "blessingCategories": [],
                    "objectHero": [],
                    "objectHeroType": [],
                    "routeNames": [],
                    "tourCompanies": [],
                },
            )
            group[f"{category}Mentions"] += 1
            group["sourceKeys"].append(source_key)
            group["sourceUrls"].append(clean(sources.get(source_key, {}).get("sourceUrl")))
            group["categoryMembership"].append(label)
            for field, target in [
                ("blessingCategories", "blessingCategories"),
                ("objectHero", "objectHero"),
                ("objectHeroType", "objectHeroType"),
                ("routeName", "routeNames"),
                ("tourCompany", "tourCompanies"),
            ]:
                group[target].append(clean(route.get(field)))

            category_rows.append(
                {
                    "globalRank": "",
                    "category": category,
                    "categoryLabel": label,
                    "routeRowId": clean(route.get("routeRowId")),
                    "routeId": clean(route.get("routeId")),
                    "sourceKey": source_key,
                    "templeMasterKey": key,
                    "templeName": clean(route.get("templeName")),
                    "province": clean(route.get("province")),
                    "region": clean(route.get("region")),
                    "districtArea": clean(route.get("districtArea")),
                    "placeType": clean(route.get("placeType")),
                    "globalTotalMentions": "",
                    "categoryMentions": master.get("occurrenceCount", 0),
                    "blessingCategories": clean(route.get("blessingCategories")),
                    "objectHero": clean(route.get("objectHero")),
                    "routeName": clean(route.get("routeName")),
                    "sourceName": clean(route.get("sourceName")),
                    "sourceUrl": clean(sources.get(source_key, {}).get("sourceUrl")),
                }
            )

    ranking = []
    for group in groups.values():
        total = group["popularMentions"] + group["muMentions"] + group["sacredMentions"]
        ranking.append(
            {
                "globalRank": "",
                "templeMasterKey": group["templeMasterKey"],
                "templeName": group["templeName"],
                "province": group["province"],
                "region": group["region"],
                "districtArea": group["districtArea"],
                "placeType": group["placeType"],
                "totalMentions": total,
                "popularMentions": group["popularMentions"],
                "muMentions": group["muMentions"],
                "sacredMentions": group["sacredMentions"],
                "uniqueSourceCount": len(set(filter(None, group["sourceKeys"]))),
                "categoryMembership": join_unique(group["categoryMembership"]),
                "blessingCategories": join_unique(group["blessingCategories"]),
                "objectHero": join_unique(group["objectHero"]),
                "objectHeroType": join_unique(group["objectHeroType"]),
                "routeNames": join_unique(group["routeNames"]),
                "tourCompanies": join_unique(group["tourCompanies"]),
                "sourceKeys": join_unique(group["sourceKeys"]),
                "sourceUrls": join_unique(group["sourceUrls"]),
            }
        )
    ranking.sort(key=lambda row: (-row["totalMentions"], row["province"], row["templeName"]))
    rank_by_key = {}
    total_by_key = {}
    for index, row in enumerate(ranking, start=1):
        row["globalRank"] = index
        rank_by_key[row["templeMasterKey"]] = index
        total_by_key[row["templeMasterKey"]] = row["totalMentions"]

    for row in category_rows:
        row["globalRank"] = rank_by_key.get(row["templeMasterKey"], "")
        row["globalTotalMentions"] = total_by_key.get(row["templeMasterKey"], "")
    category_rows.sort(key=lambda row: (row["globalRank"] or 999999, row["category"], row["sourceKey"], row["routeRowId"]))

    wb = load_workbook(GLOBAL_FILE) if GLOBAL_FILE.exists() else Workbook()
    global_headers = [
        "globalRank",
        "templeMasterKey",
        "templeName",
        "province",
        "region",
        "districtArea",
        "placeType",
        "totalMentions",
        "popularMentions",
        "muMentions",
        "sacredMentions",
        "uniqueSourceCount",
        "categoryMembership",
        "blessingCategories",
        "objectHero",
        "objectHeroType",
        "routeNames",
        "tourCompanies",
        "sourceKeys",
        "sourceUrls",
    ]
    category_headers = [
        "globalRank",
        "category",
        "categoryLabel",
        "routeRowId",
        "routeId",
        "sourceKey",
        "templeMasterKey",
        "templeName",
        "province",
        "region",
        "districtArea",
        "placeType",
        "globalTotalMentions",
        "categoryMentions",
        "blessingCategories",
        "objectHero",
        "routeName",
        "sourceName",
        "sourceUrl",
    ]
    source_headers = ["sourceKey", "sourceName", "sourceType", "scope", "sourceUrl"]
    write_sheet(wb, "Global_Ranking", global_headers, ranking)
    write_sheet(wb, "Global_Category_Rows", category_headers, category_rows)
    write_sheet(wb, "Source_Index_No_URL", source_headers, list(source_urls.values()))
    write_sheet(
        wb,
        "Summary",
        ["metric", "value"],
        [
            {"metric": "updatedAt", "value": date.today().isoformat()},
            {"metric": "templeCount", "value": len(ranking)},
            {"metric": "categoryRowCount", "value": len(category_rows)},
            {"metric": "sourceCount", "value": len(source_urls)},
            {"metric": "topMentionedTemples", "value": "; ".join(f"{row['templeName']} ({row['totalMentions']})" for row in ranking[:30])},
            {"metric": "note", "value": "Global counts are informational; category pages use each workbook category counts for ranking."},
        ],
    )
    if "Sheet" in wb.sheetnames and len(wb.sheetnames) > 1:
        del wb["Sheet"]
    wb.save(GLOBAL_FILE)
    print(f"Updated {GLOBAL_FILE.name}: {len(ranking)} global temples, {len(category_rows)} category rows")


if __name__ == "__main__":
    updated = update_category_workbooks()
    recompute_global(updated)
