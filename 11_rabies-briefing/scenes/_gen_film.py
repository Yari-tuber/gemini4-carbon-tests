# -*- coding: utf-8 -*-
"""Generate scenes/film.json and audio/cues.json for rabies-briefing (Engineering Briefing Board).
Master grid: 120 BPM (beat = 0.500 s, 8th = 0.250 s, 16th = 0.125 s, bar = 2.000 s).
Board: 7680 x 4320 (16:9), right_zone = [5650, 0, 7680, 4320] (unseen before reveal).
"""
import json, math
from pathlib import Path

PROJ = Path(__file__).resolve().parents[1]
LINES = json.loads((PROJ / "audio" / "lines.json").read_text(encoding="utf-8"))
DURS = json.loads((PROJ / "audio" / "vo" / "dur.json").read_text(encoding="utf-8"))


def g(t: float) -> float:
    """Snap time to exact 120 BPM 16th-note grid (0.125 s)."""
    return round(round(t / 0.125) * 0.125, 6)


def main():
    # ------------------------------------------------------------------
    # 1. Narration & Subtitle Timeline (L01..L18) on 120 BPM grid
    # ------------------------------------------------------------------
    # Planned start times on the 0.125 s grid, leaving >= speech + 0.625 s per cue,
    # plus two dramatic silences:
    #   sil1: before Blood-Brain Barrier "发病无药可救" stamp (between L07 and L08)
    #   sil2: before Final Red Ring Verdict & Long Pull-Back Reveal (between L17 and L18)
    raw_starts = {
        "L01": 0.500,
        "L02": 5.000,
        "L03": 9.875,
        "L04": 15.000,
        "L05": 20.250,
        "L06": 24.750,
        "L07": 30.375,
        # sil1 = [35.625, 37.125] (1.500 s dead silence; stamp hits at 36.500 s!)
        "L08": 37.125,
        "L09": 43.375,   # Judgement Frame 1 (Category I)
        "L10": 48.625,   # Judgement Frame 2 (Category II)
        "L11": 54.000,   # Judgement Frame 3 (Category III)
        "L12": 60.625,   # Zone 4A: 15-min soap & running water (J-cut water at 60.250 s)
        "L13": 66.250,   # Lipid envelope lysis + iodine + no immediate suture
        "L14": 72.250,   # Zone 4B: Day 0 HRIG syringe (J-cut vial clink at 71.875 s)
        "L15": 77.000,   # Steel ruler D0-D28 + 5 vaccine magnets
        "L16": 82.625,   # Zone 4C: Myth 1 ("10-day wait?") erased & corrected
        "L17": 89.000,   # Myth 2 (">24h useless?") erased & corrected
        # sil2 = [94.000, 95.500] (1.500 s dead silence; red verdict magnet & ring at 94.500 s!)
        "L18": 95.500,   # Final synthesis; whole-wall pull-back starts at reveal = 98.500 s!
    }

    subs = []
    srt_cues = []
    vo_cues = {}
    prev_t1 = 0.0
    for item in LINES:
        lid = item["id"]
        sp = float(DURS[lid])
        t0 = g(max(raw_starts[lid], prev_t1 + 0.125))
        # Ensure t1 - t0 >= max(1.85, sp + 0.625)
        t1 = round(t0 + max(1.85, sp + 0.625), 3)
        vo_cues[lid] = t0
        subs.append({
            "id": lid,
            "t0": t0,
            "t1": t1,
            "zh": item["zh"],
            "en": "",
            "speech": round(sp, 4),
        })
        srt_cues.append({
            "t0": t0,
            "t1": t1,
            "text": item["zh"],
        })
        prev_t1 = t1

    SIL1 = [g(vo_cues["L07"] + DURS["L07"] + 0.250), g(vo_cues["L08"] - 0.625)]
    STAMP1_T = SIL1[1]                             # slams right at the end of Silence 1!
    SIL2 = [g(vo_cues["L17"] + DURS["L17"] + 0.250), g(vo_cues["L18"] - 0.875)]
    VERDICT_T = SIL2[1]                            # snaps right at the end of Silence 2!
    REVEAL_T = g(vo_cues["L18"] + 3.000)           # mid-L18 ("生死全在越线前的每一步")
    DUR = g(subs[-1]["t1"] + 4.000)                # 4.0 s clean whole-wall hold after L18 subtitle ends

    # ------------------------------------------------------------------
    # 2. Camera Choreography (C2-smooth relative moves from exact keyframes)
    # ------------------------------------------------------------------
    # Every pre-reveal keyframe keeps viewport x1 < 5620 (right_zone starts at 5650)
    # and zoom >= 0.84 (<= 29.8% board width).
    cam_base = {"x": 980.0, "y": 640.0, "z": 1.48, "roll": -1.4}
    cam_keyframes = [
        # (t_start, dur, target_x, target_y, target_z, target_roll, a, b)
        # Zone 1A: widen from 100% hook to include NIAID bullet virion TEM print (plenty of bottom margin above sub)
        (4.125,  1.250, 1240.0,  700.0, 1.15,  0.0, 2.2, 2.5),
        # Zone 1B: ride horizontal leader right to Dog (99% canine)
        (9.500,  1.375, 2940.0,  690.0, 1.08,  0.5, 2.2, 2.5),
        # Zone 1B -> Cat & Flying Fox Bat (Category III high-risk)
        (14.500, 1.250, 3680.0,  700.0, 0.98, -0.4, 2.2, 2.5),
        # Follow blue projection line down-left into Zone 2: Peripheral Nerve Entry
        (19.750, 1.500, 1460.0, 1820.0, 1.08,  0.3, 2.2, 2.5),
        # Track right along Steel Ruler #1 (50-100 mm/day retrograde crawl)
        (24.375, 1.375, 2120.0, 1820.0, 1.02,  0.0, 2.2, 2.5),
        # Track right to Spinal Cord, Red Blood-Brain Barrier & CNS Brain Stamp
        (29.875, 1.375, 2760.0, 1820.0, 0.98, -0.3, 2.2, 2.5),
        # Glide down-left to Zone 3 Staircase — Judgement Frame 1 (Cat I, z=1.06)
        (41.750, 1.500, 1160.0, 2760.0, 1.06,  0.0, 2.2, 2.5),
        # Step down-right & widen — Judgement Frame 2 (Cat II, z=0.94)
        (47.875, 1.125, 1880.0, 3290.0, 0.94,  0.0, 2.2, 2.5),
        # Step down-right & widen — Judgement Frame 3 (Cat III, z=0.84)
        (53.250, 1.125, 2640.0, 3830.0, 0.84,  0.0, 2.2, 2.5),
        # Pan right to Zone 4A — 15-min Soap & Tap Water Flush + Iodine (x1=5400 < 5650)
        (59.875, 1.250, 4440.0, 2780.0, 1.00,  0.3, 2.2, 2.5),
        # Pan down to Zone 4B — Day 0 Syringe + Steel Ruler #2 (D0-D28) + Vial (x1=5460 < 5650)
        (71.375, 1.250, 4500.0, 3760.0, 1.00, -0.2, 2.2, 2.5),
        # Rise along vertical leader to Zone 4C — Myth Erasure & Final Verdict Box (x1=5540 < 5650)
        (81.625, 1.375, 4600.0, 1740.0, 1.02,  0.0, 2.2, 2.5),
        # LONG PULL-BACK REVEAL: frame the entire 7680 x 4320 wall + aluminum frame + marker tray!
        (REVEAL_T, 3.000, 3840.0, 2215.0, 0.236, 0.0, 2.2, 2.6),
    ]

    cam_moves = []
    cx, cy, cz, cr = cam_base["x"], cam_base["y"], cam_base["z"], cam_base["roll"]
    for t_m, d_m, tx, ty, tz, tr, ea, eb in cam_keyframes:
        cam_moves.append({
            "t": g(t_m),
            "d": round(d_m, 4),
            "a": ea,
            "b": eb,
            "dx": round(tx - cx, 3),
            "dy": round(ty - cy, 3),
            "dl": round(math.log(tz / cz), 6),
            "dr": round(tr - cr, 4),
        })
        cx, cy, cz, cr = tx, ty, tz, tr

    STAMP2_T = g(vo_cues["L11"] + 2.500)
    cam_shakes = [
        {"t": STAMP1_T, "amp": 9.5, "k": 7.0, "f": 9.5, "dir": [0.25, 1.0], "roll": 0.14},
        {"t": STAMP2_T, "amp": 7.0, "k": 7.5, "f": 10.0, "dir": [0.2, 1.0], "roll": 0.10},
    ]

    # ------------------------------------------------------------------
    # 3. Board Elements & Synchronized Sound/Grid Events
    # ------------------------------------------------------------------
    els = []
    ev = []

    def add_hit(t_hit: float, kind: str, **extra):
        ev.append({"t": g(t_hit), "type": kind, **extra})

    for item in LINES:
        lid = item["id"]
        ev.append({"t": vo_cues[lid], "type": "vo", "id": lid, "d": round(float(DURS[lid]), 4)})

    def drop_print(eid: str, src: str, xy: list[float], w: float, t_land: float, rot: float = 0.0, lift: float = 200.0, z: float = 14.0):
        # d=0.625, land=0.60 => lands exactly at arrive.t + 0.375 = t_land!
        t_arr = g(t_land - 0.375)
        els.append({
            "id": eid,
            "type": "print",
            "src": src,
            "xy": xy,
            "w": w,
            "z": z,
            "rot": rot,
            "arrive": {"kind": "drop", "t": t_arr, "d": 0.625, "lift": lift, "land": 0.60, "spin": 1.6 if rot >= 0 else -1.6},
        })
        add_hit(t_land, "land", id=eid)

    def add_tag(eid: str, text: str, xy: list[float], t_hit: float, size: int = 48, color: str = "graphite", mag: str = "graphite", rot: float = 0.0, strike: dict | None = None):
        els.append({
            "id": eid,
            "type": "tag",
            "text": text,
            "xy": xy,
            "size": size,
            "color": color,
            "magnetColor": mag,
            "rot": rot,
            "z": 22,
            "arrive": {"kind": "swing", "t": g(t_hit), "d": 0.500, "amp": 10},
            **({"strike": strike} if strike else {}),
        })
        add_hit(t_hit, "tag", id=eid)
        if strike:
            add_hit(strike["t"], "strike", id=eid)

    def add_magnet(eid: str, xy: list[float], t_hit: float, col: str = "red", r: int = 34):
        els.append({
            "id": eid,
            "type": "magnet",
            "xy": xy,
            "r": r,
            "color": col,
            "z": 26,
            "arrive": {"kind": "snap", "t": g(t_hit), "d": 0.250, "lift": 75},
        })
        add_hit(t_hit, "magnet", id=eid)

    def add_write(eid: str, text: str, xy: list[float], t_start: float, d: float = 0.625, size: int = 60, color: str = "graphite", align: str = "center", erase: dict | None = None, on_print: bool = False):
        ts = g(t_start)
        els.append({
            "id": eid,
            "type": "ink",
            "kind": "write",
            "text": text,
            "xy": xy,
            "t": ts,
            "d": d,
            "size": size,
            "color": color,
            "align": align,
            **({"erase": erase} if erase else {}),
            **({"onPrint": True} if on_print else {}),
        })
        ev.append({"t": ts, "type": "write", "d": d, "id": eid})
        if erase:
            ev.append({"t": g(erase["t"]), "type": "erase", "d": erase.get("d", 0.375), "id": eid})

    def add_line(eid: str, points: list[list[float]], t_start: float, d: float = 0.500, lw: int = 10, color: str = "graphite", dash: list[int] | None = None, arrow: bool = False):
        ts = g(t_start)
        els.append({
            "id": eid,
            "type": "ink",
            "kind": "line",
            "points": points,
            "t": ts,
            "d": d,
            "lw": lw,
            "color": color,
            **({"dash": dash} if dash else {}),
            **({"arrow": True} if arrow else {}),
        })
        ev.append({"t": ts, "type": "stroke", "d": d, "id": eid})
        if arrow:
            add_hit(ts + d, "arrow", id=eid)

    def add_dim(eid: str, p_from: list[float], p_to: list[float], t_start: float, d: float = 0.500, lw: int = 9, color: str = "blue", ext: list[list[float]] | None = None):
        ts = g(t_start)
        els.append({
            "id": eid,
            "type": "ink",
            "kind": "dim",
            "from": p_from,
            "to": p_to,
            "t": ts,
            "d": d,
            "lw": lw,
            "color": color,
            **({"ext": ext} if ext else {}),
        })
        ev.append({"t": ts, "type": "stroke", "d": d, "id": eid})
        add_hit(ts + d, "arrow", id=eid)

    # ==================== ZONE 1A: 100% Fatality Hook & Bullet Virion ====================
    # Cold-open red marker number (within first 0.25 s!)
    add_write("w_hook_100", "≈100%", [760, 560], 0.250, d=0.625, size=195, color="red", align="center")
    add_tag("tag_hook_fatal", "狂犬病临床致死率", [520, 720], 0.500, size=48, color="graphite", mag="red", rot=-0.8)
    add_line("ln_hook_under", [[510, 605], [1010, 605]], 1.000, d=0.375, lw=12, color="red")

    # L02: NIAID colorized TEM print of bullet-shaped rabies virions
    drop_print("p_em_niaid", "em_niaid", [1620, 565], w=660, t_land=5.250, rot=1.2, lift=180)
    add_magnet("m_em_l", [1340, 255], 5.375, col="graphite", r=30)
    add_magnet("m_em_r", [1900, 263], 5.500, col="graphite", r=30)
    add_dim("dim_virion", [1310, 935], [1930, 935], 5.750, d=0.500, lw=9, color="blue", ext=[[1310, 900, 955], [1930, 900, 955]])
    add_write("w_virion_nm", "弹状病毒 · 180×75 nm", [1620, 1002], 6.000, d=0.625, size=50, color="blue", align="center")
    add_line("arr_envelope", [[1140, 845], [1360, 700]], 6.000, d=0.375, lw=9, color="red", arrow=True)
    add_tag("tag_envelope", "脆弱脂质包膜", [710, 865], 6.125, size=46, color="red", mag="red", rot=0.6)

    # ==================== ZONE 1B: Animal Reservoirs (Dog 99%, Cat, Bat) ====================
    add_line("ln_z1_bridge", [[1980, 585], [2480, 585]], 9.500, d=0.875, lw=10, color="graphite", arrow=True)
    drop_print("p_dog", "dog", [2760, 610], w=620, t_land=10.500, rot=-1.0, lift=180)
    add_write("w_deaths_yr", "全球 5.9万例/年", [2760, 1015], 10.875, d=0.625, size=56, color="graphite", align="center")
    add_tag("tag_dog_99", "99% 犬类传播", [3120, 470], 11.750, size=52, color="red", mag="red", rot=-0.5)
    for k in range(5):
        add_magnet(f"m_dog_{k}", [3160 + k * 76, 595], 12.125 + k * 0.125, col="red" if k < 4 else "graphite", r=28)

    # L04: Cat & Bat (Category III high risk)
    drop_print("p_cat", "cat", [3460, 845], w=500, t_land=15.250, rot=1.4, lift=170)
    add_tag("tag_cat_wild", "猫与野生动物", [3240, 1075], 15.500, size=44, color="graphite", mag="graphite", rot=0.5)
    drop_print("p_bat", "bat", [4150, 540], w=720, t_land=16.500, rot=-3.5, lift=190)
    add_tag("tag_bat_cat3", "碰蝙蝠＝III级", [3920, 910], 16.750, size=46, color="red", mag="red", rot=-0.8)
    els.append({
        "id": "ring_bat",
        "type": "ink",
        "kind": "ring",
        "c": [4145, 910],
        "r": [325, 86],
        "t": g(17.125),
        "d": 0.500,
        "lw": 9,
        "color": "red",
    })
    ev.append({"t": g(17.125), "type": "ring", "d": 0.500, "id": "ring_bat"})

    # ==================== ZONE 2: Retrograde Axonal Crawl & Blood-Brain Barrier ====================
    # Blue dashed projection line down-left from Zone 1B into Zone 2
    add_line("ln_z1_to_z2", [[3460, 1140], [1160, 1580]], 19.625, d=1.125, lw=9, color="blue", dash=[22, 16], arrow=True)

    # Marker anatomical schematic: Peripheral wound -> Axon trunk -> Spinal cord -> CNS Brain
    add_line("ln_wound_notch", [[940, 1730], [1010, 1820], [940, 1910]], 20.750, d=0.375, lw=12, color="red")
    add_line("ln_axon_trunk", [[1010, 1820], [3120, 1820]], 21.000, d=1.375, lw=14, color="graphite")
    # Myelin sheath segments along the axon
    for idx_m, ax_x in enumerate([1220, 1520, 1820, 2120, 2420, 2720]):
        add_line(f"ln_myelin_{idx_m}", [[ax_x, 1792], [ax_x + 190, 1792], [ax_x + 190, 1848], [ax_x, 1848], [ax_x, 1792]], 21.250 + idx_m * 0.125, d=0.250, lw=6, color="grey")

    add_tag("tag_nerve_in", "钻入外周神经", [980, 1610], 21.125, size=48, color="graphite", mag="blue", rot=-0.6)
    add_tag("tag_no_blood", "血液传播", [1020, 2020], 21.875, size=46, color="graphite", mag="graphite", rot=0.5, strike={"t": g(22.500), "d": 0.250, "color": "red"})

    # L06: Steel Ruler #1 + 50-100 mm/day retrograde crawl
    els.append({
        "id": "ruler_axon",
        "type": "ruler",
        "from": [1460, 1945],
        "to": [2820, 1945],
        "w": 72,
        "z": 20,
        "magnetColor": "graphite",
        "arrive": {"kind": "slide", "t": g(24.625), "d": 0.500, "from": [-520, 90]},
    })
    add_hit(25.125, "ruler", id="ruler_axon")
    add_dim("dim_crawl_rate", [1500, 1720], [2780, 1720], 25.375, d=0.875, lw=10, color="blue", ext=[[1500, 1775, 1700], [2780, 1775, 1700]])
    add_write("w_crawl_mm", "逆行 50–100 mm/天", [2140, 1665], 25.750, d=0.750, size=60, color="blue", align="center")

    # L07: CNS Brain outline + 1-3 months incubation window
    # Hand-drawn marker CNS / Brain silhouette on the right end of the axon (x = 3240..3620)
    brain_pts = [
        [3240, 1820], [3260, 1690], [3350, 1610], [3490, 1605],
        [3600, 1680], [3630, 1810], [3580, 1935], [3460, 1975],
        [3360, 1960], [3330, 2060], [3280, 2060], [3280, 1910], [3240, 1820],
    ]
    add_line("ln_cns_brain", brain_pts, 30.500, d=0.875, lw=12, color="graphite")
    add_write("w_cns_label", "中枢神经 / 脑", [3440, 2135], 31.125, d=0.500, size=48, color="graphite", align="center")
    add_tag("tag_incub", "潜伏期 1–3 个月", [1980, 2090], 30.875, size=48, color="blue", mag="blue", rot=-0.4)
    add_write("w_window", "黄金抢救窗口", [2660, 1555], 32.125, d=0.625, size=62, color="blue", align="center")

    # SILENCE 1: Red Blood-Brain Barrier Deadline + Heavy Red Stamp "发病无药可救"
    add_line("ln_bbb_dead", [[3140, 1480], [3140, 2180]], g(SIL1[0] + 0.125), d=0.375, lw=16, color="red")
    add_write("w_bbb_label", "血脑屏障", [3140, 1445], g(SIL1[0] + 0.250), d=0.375, size=50, color="red", align="center")
    els.append({
        "id": "st_fatal",
        "type": "stamp",
        "text": "发病无药可救",
        "xy": [3435, 1815],
        "size": 92,
        "color": "red",
        "rot": -6.0,
        "t": STAMP1_T,
        "seed": 41,
    })
    add_hit(STAMP1_T, "stamp", id="st_fatal")

    # L08: Pre-barrier intercept line
    add_write("w_pre_intercept", "越线前 · 步步可拦", [2785, 2112], g(vo_cues["L08"] + 1.500), d=0.625, size=54, color="blue", align="center")

    # ==================== ZONE 3: WHO Exposure Grading Staircase (3 Judgement Frames) ====================
    add_line("ln_z2_to_z3", [[2540, 2170], [1160, 2500]], 41.750, d=1.125, lw=9, color="graphite", dash=[20, 16], arrow=True)

    # --- Judgement Frame 1: Category I (L09) — clean top lane y = 2520..2910 ---
    c1_t = g(vo_cues["L09"])
    add_line("ln_cat1_skin", [[560, 2740], [1760, 2740]], c1_t, d=0.500, lw=12, color="graphite")
    add_tag("tag_cat1", "I级：完好皮肤被舔", [560, 2590], c1_t + 0.125, size=48, color="graphite", mag="blue", rot=0.0)
    add_write("w_cat1_act", "清洗即可 · 免打针", [1160, 2880], c1_t + 1.125, d=0.625, size=58, color="blue", align="center")

    # --- Judgement Frame 2: Category II (L10) — clean middle lane y = 3040..3460 ---
    c2_t = g(vo_cues["L10"] + 0.375)
    add_line("ln_cat2_skin", [[1240, 3265], [1780, 3265], [1860, 3335], [1940, 3265], [2520, 3265]], c2_t, d=0.500, lw=12, color="blue")
    add_tag("tag_cat2", "II级：轻咬 / 无血抓伤", [1240, 3115], c2_t + 0.125, size=48, color="blue", mag="blue", rot=0.0)
    add_write("w_cat2_act", "立即冲洗＋全程疫苗", [1880, 3440], c2_t + 1.000, d=0.625, size=58, color="blue", align="center")

    # --- Judgement Frame 3: Category III (L11) — clean bottom lane y = 3580..4070 ---
    c3_t = g(vo_cues["L11"] + 0.375)
    add_line("ln_cat3_dermis", [[1820, 3865], [3460, 3865]], c3_t, d=0.375, lw=9, color="red", dash=[18, 14])
    add_line("ln_cat3_breach", [[1840, 3775], [2340, 3775], [2440, 3965], [2540, 3775], [3440, 3775]], c3_t + 0.125, d=0.500, lw=14, color="red")
    add_tag("tag_cat3", "III级：见血 / 黏膜 / 蝙蝠", [1840, 3630], c3_t + 0.250, size=48, color="red", mag="red", rot=0.0)
    add_write("w_cat3_act", "冲洗＋疫苗", [2220, 4045], c3_t + 1.250, d=0.500, size=56, color="graphite", align="center")
    els.append({
        "id": "st_cat3_rig",
        "type": "stamp",
        "text": "加打球蛋白",
        "xy": [3060, 4010],
        "size": 88,
        "color": "red",
        "rot": -4.0,
        "t": STAMP2_T,
        "seed": 77,
    })
    add_hit(STAMP2_T, "stamp", id="st_cat3_rig")

    judge = {
        "cat1": {"box": [520, 2500, 1800, 2930], "z": 1.06, "x": 1160, "y": 2760, "t0": round(c1_t + 0.25, 3), "t1": 47.75},
        "cat2": {"box": [1200, 3020, 2560, 3490], "z": 0.94, "x": 1880, "y": 3290, "t0": round(c2_t + 0.15, 3), "t1": 53.15},
        "cat3": {"box": [1800, 3550, 3480, 4110], "z": 0.84, "x": 2640, "y": 3830, "t0": round(c3_t + 0.15, 3), "t1": 59.75},
    }

    # ==================== ZONE 4A: 15-Min Soap & Water Flush + Iodine ====================
    # Camera at (4440, 2780, z=1.00) => viewport [3480..5400, 2240..3320]
    add_line("ln_z3_to_z4a", [[3480, 3775], [3820, 2820]], 59.875, d=0.875, lw=9, color="blue", dash=[18, 14], arrow=True)
    # J-cut tap water cue 0.375 s before L12!
    ev.append({"t": g(vo_cues["L12"] - 0.375), "type": "water", "d": 4.500, "id": "water_flush"})

    t_flush = g(vo_cues["L12"] + 0.375)
    drop_print("p_tap", "tap", [3920, 2540], w=310, t_land=t_flush, rot=0.0, lift=170)
    drop_print("p_soap", "soap", [4060, 2990], w=235, t_land=g(t_flush + 0.500), rot=-2.0, lift=170)

    # Animated blue water stream hatching from tap spout onto soap bar
    water_strokes = []
    for k in range(16):
        ang_off = (k % 5 - 2) * 18
        water_strokes.append({
            "t": round(g(t_flush + 0.625) + k * 0.125, 4),
            "d": 0.22,
            "lw": 6,
            "color": "water",
            "points": [[4045 + ang_off * 0.4, 2690], [4060 + ang_off, 2875 + (k % 3) * 35]],
        })
    els.append({
        "id": "hatch_water",
        "type": "ink",
        "kind": "hatch",
        "color": "water",
        "lw": 6,
        "strokes": water_strokes,
    })

    add_dim("dim_15min", [4280, 2500], [5160, 2500], g(t_flush + 1.000), d=0.500, lw=9, color="blue")
    add_write("w_15min", "交替冲 ≥15 分钟", [4720, 2450], g(t_flush + 1.125), d=0.625, size=58, color="blue", align="center")

    # L13: Soap lyses lipid envelope + Iodine bottle + Do not suture immediately
    t_iod = g(vo_cues["L13"] + 0.375)
    add_tag("tag_lyse_env", "瓦解脂质包膜", [4280, 2700], t_iod, size=46, color="blue", mag="blue", rot=-0.5)
    drop_print("p_iodine", "iodine", [5120, 2890], w=205, t_land=g(t_iod + 1.000), rot=1.2, lift=170)
    add_tag("tag_iodine_nosut", "涂碘伏 · 勿缝合", [4280, 3040], g(t_iod + 1.375), size=46, color="red", mag="red", rot=0.4)

    # ==================== ZONE 4B: Day 0 HRIG Syringe + 28-Day Vaccine Ruler ====================
    # Camera at (4500, 3760, z=1.00) => viewport [3540..5460, 3220..4300]
    ev.append({"t": g(vo_cues["L14"] - 0.375), "type": "clink", "id": "vial_clink"})
    t_rig = g(vo_cues["L14"] + 0.375)
    drop_print("p_syringe", "syringe", [4140, 3500], w=820, t_land=t_rig, rot=-1.2, lift=170)
    add_tag("tag_d0_rig", "D0 球蛋白封口", [4640, 3490], g(t_rig + 0.375), size=48, color="red", mag="red", rot=-0.4)
    add_write("w_gap_7_14", "堵住 7–14 天抗体空窗", [4220, 3690], g(t_rig + 1.125), d=0.625, size=50, color="blue", align="center")

    # L15: Steel Ruler #2 + Glass Vial + 5 Blue Magnets (D0, D3, D7, D14, D28)
    t_vac = g(vo_cues["L15"] + 0.250)
    els.append({
        "id": "ruler_pep",
        "type": "ruler",
        "from": [3740, 3900],
        "to": [5040, 3900],
        "w": 68,
        "z": 20,
        "magnetColor": "graphite",
        "arrive": {"kind": "slide", "t": t_vac, "d": 0.500, "from": [-480, 70]},
    })
    add_hit(t_vac + 0.500, "ruler", id="ruler_pep")
    drop_print("p_vial", "vial", [5220, 3840], w=175, t_land=g(t_vac + 0.750), rot=1.0, lift=165)

    pep_days = [3840, 4100, 4360, 4620, 4880]
    for k, px in enumerate(pep_days):
        add_magnet(f"m_pep_{k}", [px, 3825], g(t_vac + 1.000 + k * 0.250), col="blue", r=28)
    add_write("w_pep_5dose", "D0 · D3 · D7 · D14 · D28 五针", [4390, 4040], g(t_vac + 1.125), d=0.750, size=48, color="graphite", align="center")

    # ==================== ZONE 4C: Myth Erasure Box & Final Pre-Reveal Verdict ====================
    # Camera rises to (4600, 1740, z=1.02) => viewport [3659..5541, 1211..2269] (5541 < 5650!)
    # Route vertical connector cleanly along left gutter of Zone 4 (x = 3710) into Myth Box left wall!
    add_line("ln_z4b_to_z4c", [[3710, 3480], [3710, 1740], [3830, 1740]], 81.625, d=1.125, lw=8, color="graphite", dash=[18, 16], arrow=True)
    add_line("box_myth_frame", [[3840, 1330], [5380, 1330], [5380, 2140], [3840, 2140], [3840, 1330]], 82.250, d=0.750, lw=8, color="grey")

    # L16: Myth 1 written -> held >= 3.625 s (>= need 3.48 s) -> wiped by felt eraser -> overwritten!
    t_m1 = g(vo_cues["L16"] + 0.375)       # 83.000 s
    t_m1_erase = g(t_m1 + 3.750)           # 86.750 s (held 3.750 s!)
    add_write("w_myth_10d", "误区：等10天再打？", [4610, 1515], t_m1, d=0.500, size=56, color="graphite", align="center", erase={"t": t_m1_erase, "d": 0.375, "ghost": 0.07})
    add_write("w_fact_10d", "先打针 · 同步观察", [4610, 1515], g(t_m1_erase + 0.375), d=0.500, size=58, color="blue", align="center")

    # L17: Myth 2 written -> held >= 3.625 s (>= need 3.32 s) -> wiped by felt eraser -> overwritten!
    t_m2 = g(vo_cues["L17"] - 1.500)       # 87.500 s (already in frame in Zone 4C!)
    t_m2_erase = g(t_m2 + 3.750)           # 91.250 s (held 3.750 s!)
    add_write("w_myth_24h", "误区：超24h无效？", [4610, 1735], t_m2, d=0.500, size=56, color="graphite", align="center", erase={"t": t_m2_erase, "d": 0.375, "ghost": 0.07})
    add_write("w_fact_24h", "未发病 · 补打有效", [4610, 1735], g(t_m2_erase + 0.375), d=0.500, size=58, color="blue", align="center")

    # SILENCE 2: Final Red Verdict Magnet + Write + Hand-drawn Red Ring
    add_magnet("m_verdict_red", [4010, 1965], VERDICT_T, col="red", r=36)
    add_write("w_verdict_100", "规范阻断 ≈100% 可防", [4650, 1985], g(VERDICT_T + 0.125), d=0.625, size=66, color="red", align="center")
    els.append({
        "id": "ring_verdict",
        "type": "ink",
        "kind": "ring",
        "c": [4610, 1965],
        "r": [540, 96],
        "t": g(VERDICT_T + 0.500),
        "d": 0.625,
        "lw": 11,
        "color": "red",
    })
    ev.append({"t": g(VERDICT_T + 0.500), "type": "ring", "d": 0.625, "id": "ring_verdict"})

    # ==================== RIGHT REVEAL ZONE (x = 5650..7680, already on wall at Pull-Back!) ====================
    add_hit(REVEAL_T, "reveal", id="wall_reveal")

    # 1) Top-Right Briefing Title & Verdict Card
    els.append({
        "id": "card_title",
        "type": "card",
        "xy": [6640, 720],
        "w": 1680,
        "h": 980,
        "z": 18,
        "rot": -0.4,
        "magnetR": 32,
        "magnets": [[-760, -420, "red"], [760, -420, "red"], [-760, 420, "graphite"], [760, 420, "graphite"]],
        "lines": [
            {"rule": True, "x": 90, "y": -380, "w": 1500, "h": 10, "color": "red"},
            {"text": "死线之前", "x": 90, "y": -195, "size": 156, "font": "marker", "color": "graphite"},
            {"text": "狂犬病暴露后阻断简报", "x": 95, "y": -75, "size": 68, "font": "sc", "weight": 700, "color": "blue", "pass_": True},
            {"rule": True, "x": 90, "y": -25, "w": 1500, "h": 3, "color": "grey"},
            {"text": "临床发作 ≈ 100% 致死  ｜  规范阻断 ≈ 100% 可防", "x": 95, "y": 75, "size": 52, "font": "sc", "weight": 900, "color": "red", "pass_": True},
            {"text": "WHO 狂犬病专家磋商会 TRS 1012 (2018)", "x": 95, "y": 205, "size": 38, "font": "sc", "weight": 500, "color": "grey", "pass_": True},
            {"text": "中国疾控中心《狂犬病暴露预防处置工作规范 (2023)》", "x": 95, "y": 275, "size": 38, "font": "sc", "weight": 500, "color": "grey", "pass_": True},
            {"text": "BRIEFING BOARD · ZOONOTIC PEP PROTOCOL", "x": 95, "y": 365, "size": 32, "font": "mono", "weight": 600, "color": "grey", "track": 2, "pass_": True},
        ],
    })

    # 2) Mid-Right Archival Specimen Micrograph Prints (CDC Public Domain)
    els.append({"id": "p_phil_em", "type": "print", "src": "print_phil_em", "xy": [6180, 2120], "w": 760, "z": 14, "rot": -1.8})
    els.append({"id": "m_phil_1", "type": "magnet", "xy": [5860, 1660], "r": 28, "color": "graphite", "z": 24})
    els.append({"id": "m_phil_2", "type": "magnet", "xy": [6500, 1675], "r": 28, "color": "graphite", "z": 24})

    els.append({"id": "p_negri", "type": "print", "src": "print_negri", "xy": [7120, 2140], "w": 820, "z": 14, "rot": 1.6})
    els.append({"id": "m_negri_1", "type": "magnet", "xy": [6760, 1890], "r": 28, "color": "red", "z": 24})
    els.append({"id": "m_negri_2", "type": "magnet", "xy": [7460, 1905], "r": 28, "color": "red", "z": 24})

    # 3) Bottom-Right PEP Emergency Checklist Card
    els.append({
        "id": "card_pep_summary",
        "type": "card",
        "xy": [6640, 3540],
        "w": 1680,
        "h": 920,
        "z": 18,
        "rot": 0.3,
        "magnetR": 30,
        "magnets": [[-760, -390, "blue"], [760, -390, "blue"]],
        "lines": [
            {"rule": True, "x": 85, "y": -350, "w": 1510, "h": 8, "color": "blue"},
            {"text": "暴露后黄金三步 (PEP)", "x": 85, "y": -230, "size": 74, "font": "sc", "weight": 900, "color": "graphite", "pass_": True},
            {"text": "01  肥皂水＋流动清水交替冲 ≥ 15 分钟", "x": 85, "y": -95, "size": 50, "font": "sc", "weight": 700, "color": "blue", "pass_": True},
            {"text": "02  碘伏消毒伤口 · 切勿急于包扎缝合", "x": 85, "y": 25, "size": 50, "font": "sc", "weight": 700, "color": "graphite", "pass_": True},
            {"text": "03  D0 免疫球蛋白封口 ＋ 28天5针疫苗", "x": 85, "y": 145, "size": 50, "font": "sc", "weight": 700, "color": "red", "pass_": True},
            {"rule": True, "x": 85, "y": 225, "w": 1510, "h": 3, "color": "grey"},
            {"text": "十日观察：先打针再同步观察  ｜  超24h未发病：立即补打有效", "x": 85, "y": 315, "size": 40, "font": "sc", "weight": 700, "color": "grey", "pass_": True},
        ],
    })

    # Connect Zone 4C Verdict to Right Zone Card with a long blue dashed arrow drawn during the reveal
    add_line("ln_reveal_link", [[5180, 1965], [5780, 3260]], g(REVEAL_T + 0.250), d=1.000, lw=10, color="blue", dash=[24, 18], arrow=True)

    # Sort events chronologically
    ev.sort(key=lambda x: x["t"])

    film = {
        "dur": DUR,
        "reveal": REVEAL_T,
        "board": {"w": 7680, "h": 4320, "seed": 23, "texScale": 0.42, "ghosts": 105},
        "hand": 1.0,
        "sheen": 0.075,
        "light": {"x": -1800, "y": -2400, "r": 19000, "min": 0.80},
        "shade": [
            {"t0": 18.0, "t1": 22.0, "x0": 800, "x1": 3400, "w": 520, "amt": 0.055, "ang": -16},
            {"t0": round(REVEAL_T + 0.6, 2), "t1": round(DUR + 0.8, 2), "x0": -1800, "x1": 8600, "w": 1350, "amt": 0.14, "ang": -16},
        ],
        "tray": [
            {"kind": "marker", "color": "graphite", "x": 1650, "rot": -1.8},
            {"kind": "marker", "color": "blue", "x": 2120, "rot": 1.4},
            {"kind": "marker", "color": "red", "x": 2560, "rot": -0.9},
            {"kind": "eraser", "x": 4950, "rot": 0.6},
            {"kind": "marker", "color": "graphite", "x": 5880, "rot": 2.4},
        ],
        "cam": {
            **cam_base,
            "moves": cam_moves,
            "shakes": cam_shakes,
        },
        "elements": els,
        "ev": ev,
        "subs": subs,
        "cues": {
            **vo_cues,
            "sil1": SIL1,
            "stamp1": STAMP1_T,
            "stamp2": STAMP2_T,
            "sil2": SIL2,
            "verdict": VERDICT_T,
            "reveal": REVEAL_T,
            "bpm": 120,
        },
        "judge": judge,
        "right_zone": [5650, 0, 7680, 4320],
    }

    scenes_dir = PROJ / "scenes"
    scenes_dir.mkdir(parents=True, exist_ok=True)
    (scenes_dir / "film.json").write_text(json.dumps(film, ensure_ascii=False, indent=1), encoding="utf-8")
    (PROJ / "audio" / "cues.json").write_text(json.dumps(srt_cues, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote scenes/film.json: dur={DUR:.3f}s, reveal={REVEAL_T:.3f}s, elements={len(els)}, events={len(ev)}, subs={len(subs)}")
    print(f"Silence 1: {SIL1[0]:.3f}..{SIL1[1]:.3f}s (stamp1 at {STAMP1_T:.3f}s)")
    print(f"Silence 2: {SIL2[0]:.3f}..{SIL2[1]:.3f}s (verdict at {VERDICT_T:.3f}s)")


if __name__ == "__main__":
    main()
