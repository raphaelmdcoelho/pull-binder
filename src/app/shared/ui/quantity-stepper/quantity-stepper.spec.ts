import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QuantityStepper } from './quantity-stepper';

@Component({
  imports: [QuantityStepper],
  template: `<pb-quantity-stepper
    label="Quantity"
    decreaseLabel="Less"
    increaseLabel="More"
    [max]="3"
    [(value)]="value"
  />`,
})
class Host {
  readonly value = signal(1);
}

describe('QuantityStepper', () => {
  function make() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      less: el.querySelector<HTMLButtonElement>('[aria-label="Less"]')!,
      more: el.querySelector<HTMLButtonElement>('[aria-label="More"]')!,
      input: el.querySelector<HTMLInputElement>('input')!,
    };
  }

  it('steps within the bounds and disables the buttons at the ends', () => {
    const { fixture, host, less, more } = make();
    expect(less.disabled).toBe(true);
    more.click();
    more.click();
    fixture.detectChanges();
    expect(host.value()).toBe(3);
    expect(more.disabled).toBe(true);
    more.click();
    expect(host.value()).toBe(3);
  });

  it('clamps typed values and ignores junk', () => {
    const { host, input } = make();
    input.value = '99';
    input.dispatchEvent(new Event('input'));
    expect(host.value()).toBe(3);
    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(host.value()).toBe(3);
    input.value = '0';
    input.dispatchEvent(new Event('input'));
    expect(host.value()).toBe(1);
  });

  it('labels the input', () => {
    const { input } = make();
    const label = (input.getRootNode() as Document | ShadowRoot).querySelector('label');
    expect(label?.getAttribute('for')).toBe(input.id);
    expect(input.id).toMatch(/^pb-stepper-/);
  });
});
