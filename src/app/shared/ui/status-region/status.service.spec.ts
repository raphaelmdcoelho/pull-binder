import { TestBed } from '@angular/core/testing';
import { provideTestI18n } from '../../../../testing/transloco';
import { StatusRegion } from './status-region';
import { StatusService } from './status.service';

describe('StatusService and StatusRegion', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps the live region in the DOM, hidden, before any message', () => {
    TestBed.configureTestingModule({ providers: [provideTestI18n()] });
    const fixture = TestBed.createComponent(StatusRegion);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="status"]')).toBeTruthy();
    expect(el.querySelector<HTMLElement>('.pb-status')!.hidden).toBe(true);
  });

  it('shows a success as role=status and an error as role=alert, then clears', () => {
    TestBed.configureTestingModule({ providers: [provideTestI18n()] });
    const service = TestBed.inject(StatusService);
    const fixture = TestBed.createComponent(StatusRegion);
    service.announce('Saved');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Saved');
    service.announce('Failed', 'error');
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Failed');
    vi.advanceTimersByTime(6000);
    fixture.detectChanges();
    expect(el.querySelector<HTMLElement>('.pb-status')!.hidden).toBe(true);
  });
});
