import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

export const shareImageAlt = "Samuelsson Cuts Scheduler";

export const shareImageSize = {
  width: 1200,
  height: 630,
};

export const shareImageContentType = "image/png";

async function getLogoDataUrl() {
  const logo = await readFile(join(process.cwd(), "public/logo-dark.png"));
  return `data:image/png;base64,${logo.toString("base64")}`;
}

export async function createShareImageResponse() {
  const logoSrc = await getLogoDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background: "#050505",
          color: "#fafaf9",
          fontFamily:
            "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 74% 20%, rgba(250,250,249,0.12), transparent 25%), radial-gradient(circle at 18% 86%, rgba(168,162,158,0.11), transparent 32%), linear-gradient(135deg, #050505 0%, #0c0a09 48%, #161312 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            opacity: 0.24,
            background:
              "repeating-linear-gradient(135deg, transparent 0px, transparent 30px, rgba(250,250,249,0.12) 30px, rgba(250,250,249,0.12) 31px, transparent 31px, transparent 62px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            opacity: 0.12,
            background:
              "linear-gradient(rgba(250,250,249,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(250,250,249,0.14) 1px, transparent 1px)",
            backgroundSize: "96px 96px",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: 420,
            display: "flex",
            opacity: 0.44,
            background:
              "repeating-linear-gradient(135deg, rgba(250,250,249,0.12) 0px, rgba(250,250,249,0.12) 8px, transparent 8px, transparent 30px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 72,
            top: 64,
            display: "flex",
            gap: 10,
          }}
        >
          {["BOOK", "CONFIRM", "CUT"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 34,
                padding: "0 14px",
                border: "1px solid rgba(250,250,249,0.16)",
                borderRadius: 999,
                color: "#d6d3d1",
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: 0,
              }}
            >
              {label}
            </div>
          ))}
        </div>
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "62px 78px 66px",
          }}
        >
          {/* ImageResponse renders plain HTML, so the real PNG wordmark is embedded directly. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Samuelsson Cuts"
            src={logoSrc}
            style={{
              width: 620,
              height: 177,
              objectFit: "contain",
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                color: "#a8a29e",
                fontSize: 22,
                fontWeight: 500,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 999,
                  background: "#fafaf9",
                }}
              />
              Private barbershop scheduling
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: 820,
                color: "#fafaf9",
                fontSize: 92,
                fontWeight: 680,
                lineHeight: 0.9,
                letterSpacing: 0,
              }}
            >
              Book your cut.
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: 600,
                color: "#a8a29e",
                fontSize: 26,
                fontWeight: 500,
                lineHeight: 1.28,
                letterSpacing: 0,
              }}
            >
              Request a time, confirm the appointment, and keep every visit in
              one clean schedule.
            </div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: 78,
            bottom: 66,
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "#a8a29e",
            fontSize: 20,
            fontWeight: 500,
          }}
        >
          <div
            style={{
              width: 44,
              height: 1,
              background: "rgba(250,250,249,0.36)",
            }}
          />
          samuelsson-cuts
        </div>
      </div>
    ),
    shareImageSize,
  );
}
