"""Browser tests for the lyric display app.

Playback tests install Playwright's fake clock before loading the page,
so the 2-second auto-advance runs instantly and deterministically.
"""
import re
from pathlib import Path

import pytest
from playwright.sync_api import Page, expect

ROOT = Path(__file__).resolve().parent.parent
SHORT = "/?file=tests/fixtures/short.txt"
SHORT_LINES = ["First line", "Second line", "Third line", "Fourth line"]

# Slider steps, matching SPEEDS in js/app.js
DEFAULT_STEP = "4"  # 2 s per line
FASTEST_STEP = "9"  # 0.5 s per line


def current_line(page: Page):
    # Outgoing lines linger briefly during the crossfade, so skip them
    return page.locator(".slot:not(.leaving) .text")


def expect_line(page: Page, n: int, total: int = len(SHORT_LINES)):
    expect(current_line(page)).to_have_text(SHORT_LINES[n - 1])
    expect(page.locator("#progress-text")).to_have_text(f"Line {n} of {total}")


@pytest.fixture
def short(page: Page):
    page.clock.install()
    page.goto(SHORT)
    expect_line(page, 1)
    return page


# --- Loading -----------------------------------------------------------------

def test_default_loads_lyrics_txt(page: Page, console_errors):
    lines = [l.strip() for l in (ROOT / "lyrics.txt").read_text().splitlines() if l.strip()]
    page.goto("/")
    expect(current_line(page)).to_have_text(lines[0])
    expect(page.locator("#progress-text")).to_have_text(f"Line 1 of {len(lines)}")
    expect(page.locator("#title")).to_have_text("lyrics")
    expect(page.locator("#loader")).to_be_hidden()
    assert console_errors == []


def test_blank_lines_skipped_and_whitespace_trimmed(short: Page):
    expect(short.locator("#progress-text")).to_have_text("Line 1 of 4")
    for n in range(2, 5):
        short.click("#next")
        expect_line(short, n)


def test_missing_file_shows_picker_and_picker_loads_lyrics(page: Page):
    page.goto("/?file=does-not-exist.txt")
    expect(page.locator("#loader")).to_be_visible()
    expect(page.locator("#filename")).to_have_text("does-not-exist.txt")
    expect(page.locator("#play")).to_be_disabled()

    page.set_input_files("#file", files=[{
        "name": "my_song.txt", "mimeType": "text/plain", "buffer": b"Alpha\n\nBeta\n",
    }])
    expect(page.locator("#loader")).to_be_hidden()
    expect(current_line(page)).to_have_text("Alpha")
    expect(page.locator("#progress-text")).to_have_text("Line 1 of 2")
    expect(page.locator("#title")).to_have_text("my song")


def expect_no_lyrics(page: Page):
    expect(current_line(page)).to_have_text("This file has no lyrics.")
    expect(page.locator("#progress-text")).to_have_text("")
    for sel in ["#prev", "#play", "#next"]:
        expect(page.locator(sel)).to_be_disabled()


def test_blank_file_shows_message(page: Page):
    page.goto("/?file=tests/fixtures/blank.txt")
    expect_no_lyrics(page)


def test_picking_blank_file_clears_previous_song(short: Page):
    short.set_input_files("#file", str(ROOT / "tests/fixtures/blank.txt"))
    expect_no_lyrics(short)


# --- Navigation --------------------------------------------------------------

def test_next_and_previous(short: Page):
    expect(short.locator("#prev")).to_be_disabled()
    short.click("#next")
    expect_line(short, 2)
    short.click("#prev")
    expect_line(short, 1)


def test_buttons_disabled_at_edges(short: Page):
    for _ in range(3):
        short.click("#next")
    expect_line(short, 4)
    expect(short.locator("#next")).to_be_disabled()
    expect(short.locator("#prev")).to_be_enabled()


def test_line_number_and_progress(short: Page):
    short.click("#next")
    expect(short.locator(".slot:not(.leaving) .num")).to_have_text("02")
    expect(short.locator("#percent")).to_have_text("50%")
    expect(short.locator("#up-next")).to_contain_text("Third line")


def test_progress_bar_click_jumps(short: Page):
    box = short.locator("#bar").bounding_box()
    # Click at ~90% across the bar: the last of 4 lines
    short.mouse.click(box["x"] + box["width"] * 0.9, box["y"] + box["height"] / 2)
    expect_line(short, 4)


# --- Playback ----------------------------------------------------------------

def test_play_toggles_to_pause_and_back(short: Page):
    play = short.locator("#play")
    expect(play).to_have_text("Play")
    play.click()
    expect(play).to_have_text("Pause")
    play.click()
    expect(play).to_have_text("Play")


def test_play_advances_every_two_seconds(short: Page):
    short.click("#play")
    short.clock.run_for(1900)
    expect_line(short, 1)
    short.clock.run_for(200)
    expect_line(short, 2)
    short.clock.run_for(2000)
    expect_line(short, 3)


def test_play_stops_on_last_line(short: Page):
    short.click("#play")
    short.clock.run_for(2000 * 3)
    expect_line(short, 4)
    expect(short.locator("#play")).to_have_text("Play")
    short.clock.run_for(4000)
    expect_line(short, 4)


def test_play_at_end_restarts_from_top(short: Page):
    for _ in range(3):
        short.click("#next")
    short.click("#play")
    expect_line(short, 1)
    expect(short.locator("#play")).to_have_text("Pause")


def test_next_during_playback_pauses(short: Page):
    short.click("#play")
    short.click("#next")
    expect(short.locator("#play")).to_have_text("Play")
    short.clock.run_for(5000)
    expect_line(short, 2)


# --- Speed slider ------------------------------------------------------------

def test_speed_slider_defaults_to_two_seconds(short: Page):
    expect(short.locator("#speed")).to_have_value(DEFAULT_STEP)
    expect(short.locator("#speed-value")).to_have_text("2 s / line")


def test_speed_slider_changes_delay(short: Page):
    short.locator("#speed").fill(FASTEST_STEP)
    expect(short.locator("#speed-value")).to_have_text("0.5 s / line")
    short.click("#play")
    short.clock.run_for(500)
    expect_line(short, 2)


def test_speed_change_applies_mid_playback(short: Page):
    short.click("#play")
    short.clock.run_for(1000)
    short.locator("#speed").fill(FASTEST_STEP)
    short.clock.run_for(500)
    expect_line(short, 2)
    expect(short.locator("#play")).to_have_text("Pause")


def test_speed_is_remembered_after_reload(short: Page):
    short.locator("#speed").fill(FASTEST_STEP)
    short.reload()
    expect(short.locator("#speed")).to_have_value(FASTEST_STEP)
    expect(short.locator("#speed-value")).to_have_text("0.5 s / line")


# --- Keyboard ----------------------------------------------------------------

def test_arrow_keys_navigate(short: Page):
    short.keyboard.press("ArrowRight")
    expect_line(short, 2)
    short.keyboard.press("ArrowLeft")
    expect_line(short, 1)


def test_space_toggles_playback(short: Page):
    short.keyboard.press("Space")
    expect(short.locator("#play")).to_have_text("Pause")
    short.keyboard.press("Space")
    expect(short.locator("#play")).to_have_text("Play")


def test_space_after_clicking_play_pauses_once(short: Page):
    # Clicking leaves focus on the button; Space must not toggle twice
    short.click("#play")
    short.keyboard.press("Space")
    expect(short.locator("#play")).to_have_text("Play")


def test_plus_minus_change_speed(short: Page):
    short.keyboard.press("+")
    expect(short.locator("#speed-value")).to_have_text("1.5 s / line")
    short.keyboard.press("-")
    short.keyboard.press("-")
    expect(short.locator("#speed-value")).to_have_text("2.5 s / line")


def test_arrows_on_focused_slider_do_not_change_line(short: Page):
    short.locator("#speed").focus()
    short.keyboard.press("ArrowRight")
    expect(short.locator("#speed-value")).to_have_text("1.5 s / line")
    expect_line(short, 1)


# --- Layout ------------------------------------------------------------------

@pytest.mark.parametrize("width,height", [(375, 667), (768, 1024), (1440, 900), (740, 360)])
def test_fits_screen(page: Page, width, height):
    page.set_viewport_size({"width": width, "height": height})
    # Sonnet 18 has long lines, which stress wrapping and the "Up next" row
    page.goto("/?file=sonnet_18.txt")
    expect(page.locator("#progress-text")).to_have_text("Line 1 of 14")
    overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    assert overflow <= 0, f"page scrolls sideways by {overflow}px at {width}x{height}"
    # Centred content can also spill off the left edge, which scrollWidth doesn't catch
    card = page.locator(".card").bounding_box()
    assert card["x"] >= 0 and card["x"] + card["width"] <= width, f"card overflows at {width}x{height}: {card}"
    for sel in ["#prev", "#play", "#next", "#speed"]:
        expect(page.locator(sel)).to_be_in_viewport()
