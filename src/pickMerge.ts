import xs, {Stream, InternalListener, OutSender, Operator} from 'xstream';
import {Instances} from './index';

class PickMergeListener<Si, T> implements InternalListener<T>, OutSender<T> {
  public ins: Stream<T>;
  public out: Stream<T>;
  public p: PickMerge<Si, T>;

  constructor(out: Stream<T>, p: PickMerge<Si, T>, ins: Stream<T>) {
    this.ins = ins;
    this.out = out;
    this.p = p;
  }

  _n(t: T): void {
    const p = this.p, out = this.out;
    if (out === null) {
      return;
    }
    out._n(t);
  }

  _e(err: any): void {
    const out = this.out;
    if (out === null) {
      return;
    }
    out._e(err);
  }

  _c(): void {
  }
}

class PickMerge<Si, T> implements Operator<Instances<Si>, T> {
  public type = 'pickMerge';
  public ins: Stream<Instances<Si>>;
  public out: Stream<T>;
  public sel: string;
  public ils: Map<string, PickMergeListener<Si, T>>;
  public inst: Instances<Si>;

  constructor(sel: string, ins: Stream<Instances<Si>>) {
    this.ins = ins;
    this.out = null as any;
    this.sel = sel;
    this.ils = new Map();
    this.inst = null as any;
  }

  _start(out: Stream<T>): void {
    this.out = out;
    this.ins._add(this);
  }

  _stop(): void {
    const ils = this.ils;
    ils.forEach((il, key) => {
      il.ins._remove(il);
      il.ins = null as any;
      il.out = null as any;
      ils.delete(key);
    });
    ils.clear();
    this.out = null as any;
    this.ils = new Map();
    this.inst = null as any;
  }

  _n(inst: Instances<Si>): void {
    this.inst = inst;
    const arrSinks = inst.arr;
    const ils = this.ils;
    const out = this.out;
    const sel = this.sel;
    const n = arrSinks.length;
    // add
    for (let i = 0; i < n; ++i) {
      const sinks = arrSinks[i];
      const key = sinks._key as any as string;
      const sink = sinks[sel];
      if (!ils.has(key)) {
        ils.set(key, new PickMergeListener(out, this, sink));
      }
    }
    for (let i = 0; i < n; ++i) {
      const sinks = arrSinks[i];
      const key = sinks._key as any as string;
      const sink = sinks[sel];
      if ((sink as any)._ils.length === 0) {
        sink._add(ils.get(key));
      }
    }
    // remove
    ils.forEach((il, key) => {
      if (!inst.dict.has(key) || !inst.dict.get(key)) {
        il.ins._remove(il);
        il.ins = null as any;
        il.out = null as any;
        ils.delete(key);
      }
    });
  }

  _e(err: any) {
    const u = this.out;
    if (u === null) return;
    u._e(err);
  }

  _c() {
    const u = this.out;
    if (u === null) return;
    u._c();
  }
}

export function pickMerge(selector: string) {
  return function pickMergeOperator(inst$: Stream<Instances<any>>): Stream<any> {
    return new Stream(new PickMerge(selector, inst$));
  };
}
