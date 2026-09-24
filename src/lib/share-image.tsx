import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const shareImageAlt = "Samuelsson Cuts – online rezervácie v barbershope";

export const shareImageSize = {
  width: 1200,
  height: 630,
};

export const shareImageContentType = "image/png";

// Greyscale only: the app's dark stone palette. The reserved slot and its dial
// arc stand out by contrast (inverted like the dark-theme primary button).
const INK = "#0c0a09"; // stone-950, --background (dark)
const TEXT = "#fafaf9"; // stone-50, --foreground (dark)
const MUTED = "#a8a29e"; // stone-400, --muted-foreground (dark)

const EYEBROW = "BARBERSHOP";
const HEADLINE = ["Váš strih.", "Váš čas."];
const SUBLINE = "Rezervujte si termín online. Potvrdenie príde priamo do mobilu.";
const SLOTS = [
  { time: "09:00", booked: false },
  { time: "10:30", booked: false },
  { time: "13:15", booked: true },
  { time: "16:45", booked: false },
];
const BOOKED_LABEL = "Rezervované";

// Clock dial geometry (px). The emblem sits at native resolution in the centre.
const DIAL = { cx: 902, cy: 315, outer: 238, inner: 196, emblem: 252 };

async function publicDataUrl(file: string) {
  const data = await readFile(join(process.cwd(), "public", file));
  return `data:image/png;base64,${data.toString("base64")}`;
}

/**
 * Geist in the weights the card uses, subset to its text. ImageResponse only
 * bundles Geist Regular, and font binaries stay out of the repository, so the
 * weights come from Google Fonts at render time (TTF, which Satori reads). Any
 * failure falls back to the bundled regular weight instead of failing the image.
 */
async function loadGeist(weight: 500 | 700, text: string) {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Geist:wght@${weight}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(cssUrl, { signal: AbortSignal.timeout(5000) })).text();
    const fontUrl = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!fontUrl) return null;
    const font = await fetch(fontUrl, { signal: AbortSignal.timeout(5000) });
    return font.ok ? { name: "Geist", data: await font.arrayBuffer(), weight, style: "normal" as const } : null;
  } catch {
    return null;
  }
}

/** 60 minute ticks on the dial; every fifth is a longer hour mark. */
function DialTicks() {
  return (
    <>
      {Array.from({ length: 60 }, (_, index) => {
        const hour = index % 5 === 0;
        const length = hour ? 20 : 9;
        const width = hour ? 3 : 2;
        const angle = index * 6;
        const radius = DIAL.outer - length / 2;
        const radians = (angle * Math.PI) / 180;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: DIAL.cx + radius * Math.sin(radians) - width / 2,
              top: DIAL.cy - radius * Math.cos(radians) - length / 2,
              width,
              height: length,
              borderRadius: width,
              background: hour ? "rgba(250,250,249,0.55)" : "rgba(250,250,249,0.18)",
              transform: `rotate(${angle}deg)`,
            }}
          />
        );
      })}
    </>
  );
}

function Ring({ radius, color, width = 1 }: { radius: number; color: string; width?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: DIAL.cx - radius,
        top: DIAL.cy - radius,
        width: radius * 2,
        height: radius * 2,
        borderRadius: radius * 2,
        border: `${width}px solid ${color}`,
      }}
    />
  );
}

export async function createShareImageResponse() {
  const glyphs = [EYEBROW, ...HEADLINE, SUBLINE, BOOKED_LABEL, ...SLOTS.map((slot) => slot.time)].join("");
  const [logoSrc, emblemSrc, medium, bold] = await Promise.all([
    publicDataUrl("logo-dark.png"),
    publicDataUrl("icon-dark.png"),
    loadGeist(500, glyphs),
    loadGeist(700, glyphs),
  ]);
  const fonts = [medium, bold].filter((font) => font !== null);

  // Light arc on the inner ring: a quarter of the ring's top border, turned to
  // sit around "two o'clock" like a booked slot on the dial.
  const arcRadius = DIAL.inner;
  const arcEnd = ((60 + 45) * Math.PI) / 180;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: INK,
          color: TEXT,
          fontFamily: "Geist",
        }}
      >
        {/* Soft light behind the dial, fading into the canvas. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: `radial-gradient(circle at ${DIAL.cx}px ${DIAL.cy}px, rgba(250,250,249,0.09) 0%, rgba(250,250,249,0.03) 32%, transparent 58%)`,
          }}
        />

        {/* Comb teeth along the bottom edge, echoing the comb in the mark. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 14,
            display: "flex",
            background:
              "repeating-linear-gradient(90deg, rgba(250,250,249,0.14) 0px, rgba(250,250,249,0.14) 2px, transparent 2px, transparent 8px)",
          }}
        />

        {/* Dial */}
        <Ring radius={DIAL.outer + 18} color="rgba(250,250,249,0.06)" />
        <Ring radius={DIAL.outer} color="rgba(250,250,249,0.10)" />
        <Ring radius={DIAL.inner} color="rgba(250,250,249,0.07)" />
        <DialTicks />
        <div
          style={{
            position: "absolute",
            left: DIAL.cx - arcRadius,
            top: DIAL.cy - arcRadius,
            width: arcRadius * 2,
            height: arcRadius * 2,
            borderRadius: arcRadius * 2,
            border: "5px solid transparent",
            borderTopColor: TEXT,
            transform: "rotate(60deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: DIAL.cx + arcRadius * Math.sin(arcEnd) - 7,
            top: DIAL.cy - arcRadius * Math.cos(arcEnd) - 7,
            width: 14,
            height: 14,
            borderRadius: 14,
            background: TEXT,
            border: `3px solid ${INK}`,
          }}
        />
        {/* ImageResponse renders plain HTML, so the real PNG marks are embedded directly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          src={emblemSrc}
          width={DIAL.emblem}
          height={DIAL.emblem}
          style={{
            position: "absolute",
            left: DIAL.cx - DIAL.emblem / 2,
            top: DIAL.cy - DIAL.emblem / 2,
          }}
        />

        {/* Copy column */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 640,
            height: "100%",
            padding: "60px 0 66px 80px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="Samuelsson Cuts" src={logoSrc} width={246} height={70} />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                color: MUTED,
                fontSize: 17,
                fontWeight: 500,
                letterSpacing: 3,
              }}
            >
              {EYEBROW}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 20,
                fontSize: 88,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: -3,
              }}
            >
              <span style={{ color: TEXT }}>{HEADLINE[0]}</span>
              <span style={{ color: MUTED }}>{HEADLINE[1]}</span>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 24,
                maxWidth: 470,
                color: MUTED,
                fontSize: 24,
                fontWeight: 500,
                lineHeight: 1.4,
              }}
            >
              {SUBLINE}
            </div>
          </div>

          {/* Time slots, like the booking picker, with the chosen one filled. */}
          <div style={{ display: "flex", gap: 12 }}>
            {SLOTS.map((slot) => (
              <div
                key={slot.time}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  height: 50,
                  padding: "0 20px",
                  borderRadius: 999,
                  border: slot.booked ? `1px solid ${TEXT}` : "1px solid rgba(250,250,249,0.16)",
                  background: slot.booked ? TEXT : "rgba(250,250,249,0.03)",
                  color: slot.booked ? INK : TEXT,
                  fontSize: 21,
                  fontWeight: slot.booked ? 700 : 500,
                }}
              >
                {slot.time}
                {slot.booked ? (
                  <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>{BOOKED_LABEL}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...shareImageSize, fonts },
  );
}
