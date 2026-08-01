// Regression guard for the two silent-failure bugs in the print queue. Both
// lost a print job that the customer had already paid for, and both reported
// success while doing it — so a test that only checks the happy path would
// have passed against the broken code.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const printImage = vi.fn();
const updatePrintJobStatus = vi.fn(async () => ({}));

vi.mock('../native/print', () => ({ printImage: (...a) => printImage(...a) }));
vi.mock('../api/mockApi', () => ({ updatePrintJobStatus: (...a) => updatePrintJobStatus(...a) }));

const { enqueuePrint, __resetQueueForTest } = await import('./printQueue');

const job = (jobId) => ({ jobId, printerName: 'DS-RX1', dataUrl: 'data:image/jpeg;base64,AA==', copies: 1 });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  __resetQueueForTest();
  printImage.mockReset().mockResolvedValue(1);
  updatePrintJobStatus.mockReset().mockResolvedValue({});
  globalThis.window = { dispatchEvent: () => {} };
  let store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
});

describe('printQueue', () => {
  it('still prints when localStorage is over quota', async () => {
    // The regression: the queue used to push the job, persist it, then re-read
    // localStorage to decide what to print. writeQueue swallowed
    // QuotaExceededError, so the re-read returned a queue without the job —
    // nothing printed, nothing errored, the UI sat on "queued" forever. A
    // 4R@300dpi dataURL is 1.5-3MB, so this fired in normal use.
    globalThis.localStorage.setItem = () => {
      throw new DOMException('exceeded the quota', 'QuotaExceededError');
    };

    enqueuePrint(job('job-1'));
    await flush();

    expect(printImage).toHaveBeenCalledTimes(1);
    expect(printImage).toHaveBeenCalledWith('DS-RX1', 'data:image/jpeg;base64,AA==', 1);
  });

  it('prints queued jobs one at a time, in order', async () => {
    // The regression: retries were scheduled with a bare setTimeout and
    // attemptPrint returned immediately, so processQueue's "sequential" loop
    // could overlap two jobs on a kiosk with exactly one physical printer.
    const order = [];
    let inFlight = 0;
    printImage.mockImplementation(async (_printer, dataUrl) => {
      inFlight++;
      expect(inFlight).toBe(1); // nothing else may be printing right now
      order.push(dataUrl);
      await flush();
      inFlight--;
      return 1;
    });

    enqueuePrint({ ...job('job-1'), dataUrl: 'first' });
    enqueuePrint({ ...job('job-2'), dataUrl: 'second' });
    await vi.waitFor(() => expect(order.length).toBe(2));

    expect(order).toEqual(['first', 'second']);
  });

  it('reports printed and drains the job on success', async () => {
    enqueuePrint(job('job-1'));
    await vi.waitFor(() => expect(updatePrintJobStatus).toHaveBeenCalled());

    expect(updatePrintJobStatus).toHaveBeenCalledWith('job-1', {
      status: 'printed',
      printerName: 'DS-RX1',
    });
    expect(JSON.parse(globalThis.localStorage.getItem('ff_print_queue'))).toEqual([]);
  });

  it('does not queue the same job twice', async () => {
    enqueuePrint(job('job-1'));
    enqueuePrint(job('job-1'));
    await flush();

    expect(printImage).toHaveBeenCalledTimes(1);
  });
});

// ponytail: no retry-timing test — BACKOFF_MS starts at 5s, so exercising the
// retry ladder would add 65s of wall-clock to catch a path neither regression
// lived in. Drive the backoff from a constant and fake timers if it breaks.

// A wedged spooler is indistinguishable from an idle kiosk unless the queue
// reports how long its oldest job has been waiting — the whole basis of stall
// detection, so it gets a guard.
describe('stall detection', () => {
  it('reports no age when nothing is queued', async () => {
    const { getOldestQueuedAgeMs } = await import('./printQueue');
    expect(getOldestQueuedAgeMs()).toBe(null);
  });

  it('ages from the OLDEST queued job, not the newest', async () => {
    const { getOldestQueuedAgeMs, getQueuedCount } = await import('./printQueue');
    // Never resolves: the job stays queued, which is exactly the wedged case.
    printImage.mockImplementation(() => new Promise(() => {}));
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    enqueuePrint(job('old'));
    Date.now.mockReturnValue(now + 60_000);
    enqueuePrint(job('new'));
    await flush();

    expect(getQueuedCount()).toBe(2);
    // 60s from the first job, not 0s from the second.
    expect(getOldestQueuedAgeMs()).toBe(60_000);
    Date.now.mockRestore();
  });

  it('treats a job mirrored without queuedAt as fresh, not infinitely old', async () => {
    const { getOldestQueuedAgeMs } = await import('./printQueue');
    // What an older build left in localStorage — an upgrade must not fire a
    // false stall alert on it.
    localStorage.setItem('ff_print_queue', JSON.stringify([
      { jobId: 'legacy', printerName: 'DS-RX1', dataUrl: 'x', copies: 1, attempt: 0 },
    ]));
    __resetQueueForTest();
    expect(getOldestQueuedAgeMs()).toBeLessThan(1000);
  });
});
