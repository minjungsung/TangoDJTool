/** A cancellable silence interval measured against a monotonic deadline. */
export class GapScheduler {
  constructor({ now = () => performance.now(), setTimer = (callback, delay) => setTimeout(callback, delay), clearTimer = timer => clearTimeout(timer) } = {}) {
    if (![now, setTimer, clearTimer].every(value => typeof value === 'function')) throw new TypeError('Gap scheduler clock and timers must be functions.');
    this.now = now; this.setTimer = setTimer; this.clearTimer = clearTimer; this.active = null;
  }

  get pending() { return this.active !== null; }

  wait(seconds, onTick = () => {}) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 10) return Promise.reject(new RangeError('Recording spacing must be between 0 and 10 seconds.'));
    if (typeof onTick !== 'function') return Promise.reject(new TypeError('Gap countdown callback must be a function.'));
    this.cancel();
    if (seconds === 0) {
      try { onTick(0); return Promise.resolve(true); }
      catch (error) { return Promise.reject(error); }
    }
    return new Promise((resolve, reject) => {
      const wait = { deadline: this.now() + seconds * 1000, timer: null, resolve, reject };
      this.active = wait;
      const finish = (completed, error, failed = false) => {
        if (this.active !== wait) return;
        this.active = null;
        if (wait.timer !== null) this.clearTimer(wait.timer);
        if (failed) reject(error); else resolve(completed);
      };
      const tick = () => {
        if (this.active !== wait) return;
        wait.timer = null;
        try {
          const remaining = Math.max(0, Math.min(seconds, (wait.deadline - this.now()) / 1000));
          onTick(remaining);
          // Countdown callbacks may cancel this wait or start another one.
          if (this.active !== wait) return;
          if (remaining === 0) finish(true);
          else wait.timer = this.setTimer(tick, Math.max(1, Math.min(100, remaining * 1000)));
        } catch (error) { finish(false, error, true); }
      };
      tick();
    });
  }

  cancel() {
    const wait = this.active;
    if (!wait) return;
    this.active = null;
    try { if (wait.timer !== null) this.clearTimer(wait.timer); }
    finally { wait.resolve(false); }
  }
}
