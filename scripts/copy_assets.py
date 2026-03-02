import os
import shutil
import glob

SOURCE_DIR = r"C:\Users\46093\.gemini\antigravity\brain\5e18a617-595f-40b3-bc2d-bb224d56ce4f"
DEST_DIR = r"d:\Tool\AntiTest\public\assets"

os.makedirs(DEST_DIR, exist_ok=True)

# 映射字典：原始文件前缀 -> 目标文件名
mapping = {
    "mahjong_bamboo_tiles_v2_": "tiles_tiao.png",
    "mahjong_character_tiles_v2_": "tiles_wan.png",
    "mahjong_dots_tiles_v2_": "tiles_bing.png",
    "mahjong_honor_tiles_v2_": "tiles_zi.png",
    "sparrow_character_icons_": "sparrows.png",
    "talisman_cards_": "talismans.png",
    "booster_packs_": "packs.png"
}

def move_assets():
    files = glob.glob(os.path.join(SOURCE_DIR, "*.png"))
    for f in files:
        basename = os.path.basename(f)
        for prefix, new_name in mapping.items():
            if basename.startswith(prefix):
                dest_path = os.path.join(DEST_DIR, new_name)
                print(f"Copying {basename} -> {new_name}")
                shutil.copy2(f, dest_path)
                break
                
if __name__ == "__main__":
    move_assets()
    print("Done copying assets!")
