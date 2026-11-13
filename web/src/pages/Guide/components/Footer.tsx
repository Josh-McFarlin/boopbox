// SPDX-License-Identifier: GPL-3.0-only
// The credits, as on the home page.
export default function Footer() {
  return (
    <footer className="border-t-4 border-line">
      <div className="mx-auto max-w-[1200px] px-6 pt-8 pb-12 text-[13px] text-dim">
        BoopBox is based on{' '}
        <a href="https://github.com/isod89/sloop-fm1">SLOOP</a>, itself based on
        Felucca by Leo Kuroshita (@kurogedelic), Hügelton Instruments. GPL-3.0,
        no warranty. M-VAVE and FM-1 are trademarks of their respective owners;
        BoopBox is not affiliated with them.
      </div>
    </footer>
  )
}
