import { TestBed } from '@angular/core/testing';
import { CardImage } from './card-image';

function make(src: string | null) {
  const fixture = TestBed.createComponent(CardImage);
  fixture.componentRef.setInput('src', src);
  fixture.componentRef.setInput('alt', 'Pikachu 5');
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('CardImage', () => {
  it('shows a skeleton until the image loads, then removes it', () => {
    const { fixture, el } = make('https://img.test/a.webp');
    expect(el.querySelector('pb-skeleton')).toBeTruthy();
    el.querySelector('img')!.dispatchEvent(new Event('load'));
    fixture.detectChanges();
    expect(el.querySelector('pb-skeleton')).toBeNull();
  });

  it('is lazy, has alt text and reserves the 63:88 box', () => {
    const { el } = make('https://img.test/a.webp');
    const img = el.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('alt')).toBe('Pikachu 5');
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['63', '88']);
  });

  it('falls back to a labelled placeholder when there is no image', () => {
    const { el } = make(null);
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Pikachu 5');
  });

  it('falls back when the image fails to load', () => {
    const { fixture, el } = make('https://img.test/missing.webp');
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[role="img"]')).toBeTruthy();
  });
});
