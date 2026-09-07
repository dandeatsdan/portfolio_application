"""
BP Horizon X colour palette and shared Plotly/CSS constants.

All hex values are from the official BP colour palette.
Use these in Plotly figures and st.markdown CSS rather than
hard-coding colours in page files.
"""

# ── Core brand ──────────────────────────────────────────────────────────────
DEEP_GREEN   = "#003600"   # main canvas background
DARK_GREEN   = "#004F00"   # sidebar / card backgrounds
GREEN        = "#007F00"   # borders
LIGHT_GREEN  = "#8EDF00"   # primary accent — buttons, active elements
BRIGHT_GREEN = "#CCFF00"   # highlight
PALE_GREEN   = "#CBF296"   # subtle positive

WHITE        = "#FFFFFF"
YELLOW       = "#FFE600"

# ── Semantic ──────────────────────────────────────────────────────────────
POSITIVE     = LIGHT_GREEN          # #8EDF00
NEGATIVE     = "#FF4116"            # Deep Orange 2
WARNING      = "#FF9A00"            # Amber 2
MUTED        = "#BBBCAA"            # Warm Grey 3

# ── Chart series palette (in preference order) ────────────────────────────
CHART_PALETTE = [
    "#14BFC8",   # Blue 2
    "#8EDF00",   # BP Light Green
    "#0089A8",   # Blue 1
    "#FFE600",   # BP Yellow
    "#0070FF",   # Deep Blue 2
    "#983DC9",   # Purple 2
    "#FF9A00",   # Amber 2
    "#CCFF00",   # BP Bright Green
    "#004BAA",   # Deep Blue 1
    "#64009C",   # Purple 1
    "#FF4116",   # Deep Orange 2
    "#C47400",   # Amber 1
]

# ── Plotly layout base ────────────────────────────────────────────────────
PLOTLY_LAYOUT = dict(
    paper_bgcolor=DARK_GREEN,
    plot_bgcolor=DARK_GREEN,
    font=dict(color=WHITE, family="Inter, Arial, sans-serif", size=12),
    colorway=CHART_PALETTE,
    legend=dict(
        bgcolor=DEEP_GREEN,
        bordercolor=GREEN,
        borderwidth=1,
        font=dict(color=WHITE, size=11),
    ),
    xaxis=dict(
        gridcolor=GREEN,
        linecolor=GREEN,
        tickfont=dict(color=MUTED),
        title_font=dict(color=WHITE),
    ),
    yaxis=dict(
        gridcolor=GREEN,
        linecolor=GREEN,
        tickfont=dict(color=MUTED),
        title_font=dict(color=WHITE),
    ),
    margin=dict(l=40, r=20, t=40, b=40),
)


def apply_bp_layout(fig, title: str = "") -> None:
    """Apply BP Horizon X layout to a Plotly figure in-place."""
    fig.update_layout(**PLOTLY_LAYOUT, title=dict(text=title, font=dict(color=WHITE, size=14)))
    fig.update_xaxes(gridcolor=GREEN, linecolor=GREEN, tickfont_color=MUTED)
    fig.update_yaxes(gridcolor=GREEN, linecolor=GREEN, tickfont_color=MUTED)


# ── Streamlit metric delta colours ───────────────────────────────────────
# Injected via st.markdown in page files where needed.
METRIC_CSS = f"""
<style>
[data-testid="stMetricDelta"] svg {{ display: none; }}
[data-testid="stMetricDeltaIcon-Up"]   {{ color: {POSITIVE} !important; }}
[data-testid="stMetricDeltaIcon-Down"] {{ color: {NEGATIVE} !important; }}
</style>
"""

# ── Card CSS ─────────────────────────────────────────────────────────────
def card_css(bg: str = DARK_GREEN, border: str = GREEN) -> str:
    return f"""
    background-color: {bg};
    border: 1px solid {border};
    border-radius: 6px;
    padding: 1.2rem 1.4rem;
    """
