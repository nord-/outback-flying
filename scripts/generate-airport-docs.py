#!/usr/bin/env python3
"""Generate per-region airport reference docs (Markdown + map image) from
src/data/airports.ts. Read-only against the TS source; regenerate after any
airports.ts edit by re-running this script.
"""
import re
import os

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, "src", "data", "airports.ts")
OUT_DIR = os.path.join(REPO, "docs", "airports")

REGION_BLOCK_RE = re.compile(
    r"const (\w+): Omit<Airport, 'region'>\[\] = \[(.*?)\n\]",
    re.DOTALL,
)

NAME_RE = r"((?:[^'\\]|\\.)*)"
ENTRY_RE = re.compile(
    r"\{\s*icao:\s*'([^']*)',\s*name:\s*'" + NAME_RE + r"',\s*state:\s*'([^']*)',\s*"
    r"lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+),\s*type:\s*'([^']*)',\s*"
    r"runwayM:\s*(null|-?\d+),\s*surface:\s*'([^']*)',\s*lighted:\s*(true|false),\s*"
    r"fuelTypes:\s*\[([^\]]*)\],\s*fuelPriceMult:\s*([\d.]+)\s*\}"
)

REGION_META = {
    "OUTBACK": {"id": "outback", "title": "Australian Outback"},
    "AFRICA": {"id": "africa", "title": "East Africa"},
    "NAMERICA": {"id": "namerica", "title": "Alaska & the North"},
}

TYPE_LABEL = {"hub": "Hub", "regional": "Regional", "strip": "Bush strip"}
TYPE_COLOR = {"hub": "#d62728", "regional": "#1f77b4", "strip": "#2ca02c"}


def parse_airports():
    text = open(SRC, encoding="utf-8").read()
    regions = {}
    for m in REGION_BLOCK_RE.finditer(text):
        const_name, body = m.group(1), m.group(2)
        if const_name not in REGION_META:
            continue
        entries = []
        for e in ENTRY_RE.finditer(body):
            icao, name, state, lat, lon, ftype, runway, surface, lighted, fuels, mult = e.groups()
            entries.append({
                "icao": icao,
                "name": name.replace("\\'", "'"),
                "state": state,
                "lat": float(lat),
                "lon": float(lon),
                "type": ftype,
                "runwayM": None if runway == "null" else int(runway),
                "surface": surface,
                "lighted": lighted == "true",
                "fuelTypes": [f.strip().strip("'") for f in fuels.split(",") if f.strip()],
                "fuelPriceMult": float(mult),
            })
        regions[REGION_META[const_name]["id"]] = {
            "title": REGION_META[const_name]["title"],
            "airports": entries,
        }
    return regions


def make_map(region_id, title, airports, out_path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(9, 7), dpi=150)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("#f5f5f0")

    by_type = {"hub": [], "regional": [], "strip": []}
    for a in airports:
        by_type.setdefault(a["type"], []).append(a)

    for ftype in ["strip", "regional", "hub"]:  # draw hubs last so they sit on top
        pts = by_type.get(ftype, [])
        if not pts:
            continue
        xs = [p["lon"] for p in pts]
        ys = [p["lat"] for p in pts]
        size = 90 if ftype == "hub" else (45 if ftype == "regional" else 20)
        ax.scatter(xs, ys, s=size, c=TYPE_COLOR[ftype], label=TYPE_LABEL[ftype],
                   edgecolors="black", linewidths=0.4, alpha=0.9, zorder={"strip": 1, "regional": 2, "hub": 3}[ftype])

    # Label hubs and regionals only — bush strips are too dense to label.
    for a in airports:
        if a["type"] in ("hub", "regional"):
            ax.annotate(a["icao"], (a["lon"], a["lat"]), textcoords="offset points",
                        xytext=(4, 4), fontsize=6.5, color="#222")

    ax.set_title(f"{title} — airfields by type", fontsize=13, fontweight="bold")
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.set_aspect("equal", adjustable="datalim")
    ax.grid(True, linestyle=":", linewidth=0.5, alpha=0.6)
    ax.legend(loc="upper right", framealpha=0.9, fontsize=9)
    fig.tight_layout()
    fig.savefig(out_path)
    plt.close(fig)


def fmt_runway(m):
    return f"{m} m" if m is not None else "—"


def fmt_fuel(fuels):
    return ", ".join(fuels) if fuels else "None"


def make_markdown(region_id, title, airports, image_name):
    lines = []
    lines.append(f"# {title} airfields")
    lines.append("")
    lines.append(f"Reference list of every airfield in the **{title}** region of Outback Flying's "
                  f"airport catalogue (`src/data/airports.ts`), generated from the game data — not "
                  f"hand-maintained. Regenerate with `python scripts/generate-airport-docs.py` after "
                  f"editing that file.")
    lines.append("")
    lines.append(f"![{title} airfield map]({image_name})")
    lines.append("")
    hubs = [a for a in airports if a["type"] == "hub"]
    regionals = [a for a in airports if a["type"] == "regional"]
    strips = [a for a in airports if a["type"] == "strip"]
    lines.append(f"**{len(airports)} airfields** — {len(hubs)} hub, {len(regionals)} regional, {len(strips)} bush strip.")
    lines.append("")

    for label, group in [("Hubs", hubs), ("Regional fields", regionals), ("Bush strips", strips)]:
        if not group:
            continue
        lines.append(f"## {label}")
        lines.append("")
        lines.append("| ICAO | Name | State/Region | Runway | Surface | Lighted | Fuel |")
        lines.append("|------|------|------|--------|---------|---------|------|")
        for a in sorted(group, key=lambda x: x["icao"]):
            lines.append(
                f"| {a['icao']} | {a['name']} | {a['state']} | {fmt_runway(a['runwayM'])} | "
                f"{a['surface']} | {'Yes' if a['lighted'] else 'No'} | {fmt_fuel(a['fuelTypes'])} |"
            )
        lines.append("")

    return "\n".join(lines)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    regions = parse_airports()
    index_lines = ["# Airport reference", "", "Per-region airfield lists and maps, generated from "
                   "`src/data/airports.ts`.", ""]
    for region_id, data in regions.items():
        title = data["title"]
        airports = data["airports"]
        image_name = f"{region_id}-map.png"
        image_path = os.path.join(OUT_DIR, image_name)
        make_map(region_id, title, airports, image_path)
        md = make_markdown(region_id, title, airports, image_name)
        md_path = os.path.join(OUT_DIR, f"{region_id}.md")
        with open(md_path, "w", encoding="utf-8", newline="\r\n") as f:
            f.write(md)
        index_lines.append(f"- [{title}]({region_id}.md) — {len(airports)} airfields")
        print(f"wrote {md_path} and {image_path} ({len(airports)} airfields)")

    with open(os.path.join(OUT_DIR, "README.md"), "w", encoding="utf-8", newline="\r\n") as f:
        f.write("\n".join(index_lines) + "\n")


if __name__ == "__main__":
    main()
