import "../_group.css";

type HeadlineFrameProps = {
  fontFamily: string;
};

export function HeadlineFrame({ fontFamily }: HeadlineFrameProps) {
  return (
    <main className="bb-heading-frame">
      <section className="bb-heading-copy">
        <p className="bb-heading-kicker">▶ Free firmware for the M-VAVE FM-1</p>
        <h1 className="bb-heading-title" style={{ fontFamily }}>
          Turn the FM-1 into{" "}
          a <span className="bb-heading-accent">groovebox you play&nbsp;live.</span>
        </h1>
      </section>
    </main>
  );
}
