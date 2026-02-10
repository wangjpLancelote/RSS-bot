import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          padding: "54px 64px",
          background:
            "radial-gradient(circle at 20% 20%, rgba(14,165,233,0.36), rgba(14,165,233,0) 40%)," +
            "radial-gradient(circle at 80% 18%, rgba(99,102,241,0.32), rgba(99,102,241,0) 36%)," +
            "linear-gradient(125deg, #f8fafc 0%, #eef2ff 46%, #fff7ed 100%)"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 38,
            left: 42,
            width: 120,
            height: 120,
            borderRadius: 30,
            background: "linear-gradient(140deg,#0ea5e9,#6366f1,#f97316)",
            boxShadow: "0 10px 24px rgba(15,23,42,0.2)"
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            marginTop: 122
          }}
        >
          <div
            style={{
              fontSize: 34,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(2,132,199,0.9)",
              fontWeight: 700
            }}
          >
            RSS-Bot
          </div>
          <div
            style={{
              fontSize: 84,
              color: "#0f172a",
              fontWeight: 800,
              lineHeight: 1.02
            }}
          >
            使用AI重塑订阅
          </div>
          <div
            style={{
              fontSize: 32,
              color: "rgba(51,65,85,0.92)",
              maxWidth: 920
            }}
          >
            自动识别 RSS、网页智能转换、结构化增量阅读
          </div>
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}

