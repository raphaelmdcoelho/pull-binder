import { TestBed } from '@angular/core/testing';
import { Spinner } from './spinner';

describe('Spinner', () => {
  it('is a status region with a visually hidden label', () => {
    const fixture = TestBed.createComponent(Spinner);
    fixture.componentRef.setInput('label', 'Loading');
    fixture.detectChanges();
    const status = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')!;
    expect(status.textContent).toContain('Loading');
    expect(status.querySelector('.pb-spinner__ring')?.getAttribute('aria-hidden')).toBe('true');
  });
});
