import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SearchField } from './search-field';

@Component({
  imports: [SearchField],
  template: `<pb-search-field
    label="Card name"
    clearLabel="Clear"
    [debounceMs]="200"
    [(value)]="value"
    (searched)="searches.push($event)"
  />`,
})
class Host {
  readonly value = signal('');
  readonly searches: string[] = [];
}

describe('SearchField', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input')!;
    return { fixture, el, input, host: fixture.componentInstance };
  }

  function type(input: HTMLInputElement, text: string) {
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  it('labels the input and hides the clear button when empty', () => {
    const { el, input } = setup();
    expect(el.querySelector('label')?.getAttribute('for')).toBe(input.id);
    expect(el.querySelector('.pb-search__clear')).toBeNull();
  });

  it('debounces the search output and updates the value immediately', () => {
    const { fixture, input, host } = setup();
    type(input, 'char');
    type(input, 'charizard');
    expect(host.value()).toBe('charizard');
    expect(host.searches).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(host.searches).toEqual(['charizard']);
    fixture.detectChanges();
  });

  it('clears the value and emits an empty search', () => {
    const { fixture, el, input, host } = setup();
    type(input, 'pika');
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.pb-search__clear')!.click();
    fixture.detectChanges();
    expect(host.value()).toBe('');
    expect(host.searches).toEqual(['']);
    expect(input.value).toBe('');
  });
});
