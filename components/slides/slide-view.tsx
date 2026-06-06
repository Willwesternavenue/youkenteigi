import type { Slide } from "@/lib/slides/deck";
import { SLIDE_THEME as T } from "@/lib/slides/theme";
import { DiagramSvg } from "@/components/diagram/diagram-svg";
import { AIdeaLabMark, AIDEALAB_BLUE } from "@/components/brand/logo";

/**
 * Renders a single deck slide at 16:9 using container-query units (cqw), so the
 * exact same component scales to a full-size preview or a small thumbnail with
 * no JS measurement. Brand palette is slide-scoped (inline styles).
 */

const base: React.CSSProperties = {
  containerType: "inline-size",
  aspectRatio: "16 / 9",
  width: "100%",
  background: T.bg,
  color: T.text,
  overflow: "hidden",
  position: "relative",
  fontFamily: "var(--font-sans), sans-serif",
};

function Header({ index, heading }: { index?: number; heading: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1.6cqw", marginBottom: "3cqw" }}>
      <span style={{ width: "0.7cqw", height: "4.2cqw", background: T.blue, borderRadius: "1cqw" }} />
      {index !== undefined && (
        <span
          style={{
            background: T.blue,
            color: "#fff",
            fontWeight: 700,
            fontSize: "2.2cqw",
            padding: "0.6cqw 1.4cqw",
            borderRadius: "1cqw",
          }}
        >
          {String(index).padStart(2, "0")}
        </span>
      )}
      <span style={{ fontSize: "3.6cqw", fontWeight: 700 }}>{heading}</span>
    </div>
  );
}

function Pad({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "6cqw 7cqw", height: "100%", boxSizing: "border-box" }}>{children}</div>;
}

function PageNum({ n }: { n: number }) {
  return (
    <span
      style={{
        position: "absolute",
        right: "2.5cqw",
        bottom: "2cqw",
        fontSize: "1.8cqw",
        color: T.textMuted,
      }}
    >
      {n}
    </span>
  );
}

export function SlideView({ slide, n }: { slide: Slide; n: number }) {
  if (slide.type === "cover") {
    return (
      <div
        style={{
          ...base,
          background: `linear-gradient(135deg, ${T.blueDark} 0%, ${T.blue} 100%)`,
          color: "#fff",
        }}
      >
        <div style={{ padding: "10cqw 8cqw", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.6cqw", marginBottom: "4cqw" }}>
            <AIdeaLabMark style={{ width: "6cqw", height: "6cqw", color: "#fff" }} />
            <span style={{ fontSize: "3.4cqw", fontWeight: 800, letterSpacing: "0.1cqw" }}>AIdeaLab</span>
          </div>
          <div style={{ fontSize: "6.4cqw", fontWeight: 800, lineHeight: 1.15 }}>{slide.title}</div>
          {slide.subtitle && (
            <div style={{ fontSize: "3cqw", marginTop: "2cqw", opacity: 0.9 }}>{slide.subtitle}</div>
          )}
          {slide.client && (
            <div style={{ fontSize: "2.6cqw", marginTop: "5cqw", fontWeight: 600 }}>{slide.client}</div>
          )}
          {slide.footer && (
            <div style={{ fontSize: "2cqw", marginTop: "0.8cqw", opacity: 0.8 }}>{slide.footer}</div>
          )}
        </div>
      </div>
    );
  }

  if (slide.type === "endcard") {
    return (
      <div style={{ ...base, background: AIDEALAB_BLUE, color: "#fff" }}>
        {/* oversized translucent brand mark (bottom-right) */}
        <div
          style={{
            position: "absolute",
            right: "-12cqw",
            bottom: "-18cqw",
            width: "80cqw",
            height: "80cqw",
            opacity: 0.12,
          }}
        >
          <AIdeaLabMark style={{ width: "100%", height: "100%", color: "#fff" }} />
        </div>
        {/* logo */}
        <div
          style={{
            position: "absolute",
            left: "9cqw",
            top: "24cqw",
            display: "flex",
            alignItems: "center",
            gap: "1.6cqw",
          }}
        >
          <AIdeaLabMark style={{ width: "6.5cqw", height: "6.5cqw", color: "#fff" }} />
          <span style={{ fontSize: "5.2cqw", fontWeight: 800, letterSpacing: "0.1cqw" }}>
            AIdeaLab
          </span>
        </div>
        {/* tagline */}
        <div
          style={{
            position: "absolute",
            left: "9cqw",
            bottom: "9cqw",
            fontSize: "2.6cqw",
            fontWeight: 600,
            letterSpacing: "0.05cqw",
          }}
        >
          {slide.tagline}
        </div>
      </div>
    );
  }

  if (slide.type === "agenda") {
    const nCols = slide.items.length > 14 ? 3 : 2;
    const per = Math.ceil(slide.items.length / nCols);
    const compact = nCols === 3;
    const cols = Array.from({ length: nCols }, (_, c) => slide.items.slice(c * per, (c + 1) * per));
    return (
      <div style={base}>
        <Pad>
          <Header heading="アジェンダ" />
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${nCols}, 1fr)`, gap: compact ? "0.8cqw 3cqw" : "1.4cqw 5cqw" }}>
            {cols.map((col, ci) => (
              <div key={ci} style={{ display: "flex", flexDirection: "column", gap: compact ? "0.8cqw" : "1.4cqw" }}>
                {col.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "1.2cqw" }}>
                    <span style={{ background: T.blue, color: "#fff", fontSize: compact ? "1.5cqw" : "1.9cqw", fontWeight: 700, width: compact ? "2.8cqw" : "3.4cqw", height: compact ? "2.8cqw" : "3.4cqw", borderRadius: "0.7cqw", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {String(ci * per + i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ fontSize: compact ? "1.9cqw" : "2.4cqw" }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Pad>
        <PageNum n={n} />
      </div>
    );
  }

  if (slide.type === "section") {
    return (
      <div style={base}>
        <Pad>
          <Header index={slide.index} heading={slide.heading + (slide.cont ? "（続き）" : "")} />
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "2cqw" }}>
            {slide.bullets.map((b, i) => (
              <li key={i} style={{ display: "flex", gap: "1.6cqw", fontSize: "2.5cqw", lineHeight: 1.4 }}>
                <span style={{ color: T.blue, fontWeight: 700, flexShrink: 0 }}>▸</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Pad>
        <PageNum n={n} />
      </div>
    );
  }

  if (slide.type === "cards") {
    const cols = slide.cards.length <= 4 ? 2 : 3;
    return (
      <div style={base}>
        <Pad>
          <Header index={slide.index} heading={slide.heading} />
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "2.4cqw" }}>
            {slide.cards.map((c, i) => (
              <div key={i} style={{ background: T.bgSoft, border: `0.2cqw solid ${T.border}`, borderRadius: "1.6cqw", padding: "2.6cqw", borderTop: `0.8cqw solid ${T.blue}` }}>
                <div style={{ fontSize: "2.3cqw", fontWeight: 700 }}>{c.title}</div>
                {c.body && <div style={{ fontSize: "1.9cqw", color: T.textMuted, marginTop: "1cqw" }}>{c.body}</div>}
              </div>
            ))}
          </div>
        </Pad>
        <PageNum n={n} />
      </div>
    );
  }

  if (slide.type === "estimate") {
    return (
      <div style={base}>
        <Pad>
          <Header heading={slide.heading} />
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "4cqw", alignItems: "start" }}>
            <div style={{ background: T.blue, color: "#fff", borderRadius: "2cqw", padding: "3.5cqw" }}>
              <div style={{ fontSize: "2.2cqw", opacity: 0.9 }}>概算合計（税込）</div>
              <div style={{ fontSize: "6.5cqw", fontWeight: 800, lineHeight: 1.1, marginTop: "0.5cqw" }}>{slide.total}</div>
              <div style={{ fontSize: "2.2cqw", marginTop: "1.5cqw", opacity: 0.95 }}>
                プラン: {slide.plan} ・ {slide.personDays}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.3cqw" }}>
              {slide.phases.slice(0, 8).map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "2.1cqw", borderBottom: `0.2cqw solid ${T.border}`, paddingBottom: "0.8cqw" }}>
                  <span style={{ color: T.textMuted }}>{p.label}</span>
                  <span style={{ fontWeight: 600 }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Pad>
        <PageNum n={n} />
      </div>
    );
  }

  if (slide.type === "schedule") {
    const maxW = Math.max(1, ...slide.phases.map((p) => p.weeks));
    return (
      <div style={base}>
        <Pad>
          <Header heading={`${slide.heading}（${slide.start} 〜 ${slide.end}）`} />
          <div style={{ display: "flex", flexDirection: "column", gap: "1.6cqw" }}>
            {slide.phases.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "2cqw" }}>
                <span style={{ width: "20cqw", fontSize: "2.1cqw", flexShrink: 0 }}>{p.phase}</span>
                <div style={{ flex: 1, height: "3cqw", background: T.bgSoft, borderRadius: "0.8cqw" }}>
                  <div style={{ width: `${(p.weeks / maxW) * 100}%`, height: "100%", background: T.blue, borderRadius: "0.8cqw", display: "flex", alignItems: "center", paddingLeft: "1.2cqw", boxSizing: "border-box" }}>
                    <span style={{ color: "#fff", fontSize: "1.7cqw", fontWeight: 600 }}>{p.weeks}週間</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {slide.milestones.length > 0 && (
            <div style={{ marginTop: "3cqw", display: "flex", flexWrap: "wrap", gap: "1.4cqw" }}>
              {slide.milestones.map((m, i) => (
                <span key={i} style={{ fontSize: "1.8cqw", background: T.bgSoft, border: `0.2cqw solid ${T.border}`, borderRadius: "1cqw", padding: "0.6cqw 1.4cqw" }}>
                  <span style={{ color: T.red, fontWeight: 700 }}>◆</span> {m.date} {m.title}
                </span>
              ))}
            </div>
          )}
        </Pad>
        <PageNum n={n} />
      </div>
    );
  }

  if (slide.type === "diagram") {
    return (
      <div style={base}>
        <Pad>
          <Header heading={slide.heading} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "38cqw",
            }}
          >
            <DiagramSvg scene={slide.scene} fit="contain" ariaLabel={slide.heading} />
          </div>
        </Pad>
        <PageNum n={n} />
      </div>
    );
  }

  // closing
  return (
    <div style={base}>
      <Pad>
        <Header heading={slide.title} />
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "2.2cqw" }}>
          {slide.bullets.map((b, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: "2cqw", fontSize: "2.6cqw" }}>
              <span style={{ background: T.blue, color: "#fff", width: "4cqw", height: "4cqw", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "2.1cqw", flexShrink: 0 }}>
                {i + 1}
              </span>
              {b}
            </li>
          ))}
        </ol>
        {slide.contact && (
          <div style={{ position: "absolute", left: "7cqw", bottom: "5cqw", fontSize: "2cqw", color: T.textMuted }}>
            {slide.contact}
          </div>
        )}
        <div style={{ position: "absolute", right: "7cqw", bottom: "4.5cqw", display: "flex", alignItems: "center", gap: "1.2cqw" }}>
          <AIdeaLabMark style={{ width: "4cqw", height: "4cqw", color: T.blue }} />
          <span style={{ fontSize: "2.6cqw", fontWeight: 800, color: T.blue }}>AIdeaLab</span>
        </div>
      </Pad>
      <PageNum n={n} />
    </div>
  );
}
