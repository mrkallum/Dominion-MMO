import { describe, expect, test } from 'vitest';

// import to register custom element
import '../src/Altcha.svelte';

describe('Altcha widget DOM', () => {
  test('verify() dispatches verified event with payload', async () => {
    const el = document.createElement('altcha-widget');
    document.body.appendChild(el);
    // enable test mode to avoid remote fetch
    el.configure({ test: 1 });

    const payloadPromise = new Promise((resolve) => {
      el.addEventListener('verified', (ev: any) => {
        resolve(ev.detail.payload);
      });
    });

    await el.verify();
    const payload: any = await payloadPromise;
    expect(payload).toHaveProperty('challenge');
    expect(payload).toHaveProperty('salt');
    expect(payload).toHaveProperty('number');
    expect(typeof payload.number).toBe('number');
  });
});