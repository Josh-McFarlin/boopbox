// SPDX-License-Identifier: GPL-3.0-only
// The room server's clock, as this browser sees it. The page asks the server for its time now and then ("time"):
// the reply that came back fastest says best how far the two clocks are apart (half its round trip is the most it
// can be off). The notes carry the server time they were played at, and every listener plays them a fixed delay
// after it (config.noteDelayMs): a steady lag in place of one that moves with each message's trip.

/* the local clock in ms: monotonic (performance.now), on the same scale as Date.now */
function localNow(): number {
  return globalThis.performance
    ? globalThis.performance.timeOrigin + globalThis.performance.now()
    : Date.now()
}

const SAMPLES = 8 /* the replies kept: the fastest of them sets the offset */

export class ServerClock {
  private samples: { offset: number; rtt: number }[] = []
  private now: () => number

  constructor(now: () => number = localNow) {
    this.now = now
  }

  /* this browser's time now, for a request */
  stamp(): number {
    return this.now()
  }

  /* a reply: sent at sentAt (stamp()), the server's time when it answered */
  sample(sentAt: number, serverAt: number): void {
    const receivedAt = this.now()
    const rtt = receivedAt - sentAt
    if (
      !Number.isFinite(rtt) ||
      rtt < 0 ||
      rtt > 10_000 ||
      !Number.isFinite(serverAt)
    )
      return
    this.samples.push({ offset: serverAt - (sentAt + receivedAt) / 2, rtt })
    if (this.samples.length > SAMPLES) this.samples.shift()
  }

  get synced(): boolean {
    return this.samples.length > 0
  }

  /* server time minus local time, from the fastest reply kept (0 before any) */
  get offset(): number {
    let best: { offset: number; rtt: number } | null = null
    for (const sample of this.samples)
      if (!best || sample.rtt < best.rtt) best = sample
    return best ? best.offset : 0
  }

  /* the server's time now */
  serverNow(): number {
    return this.now() + this.offset
  }

  /* a server time, in the local clock (localNow / stamp) */
  toLocal(serverAt: number): number {
    return serverAt - this.offset
  }
}
