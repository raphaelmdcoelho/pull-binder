import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewEncapsulation,
  inject,
  input,
  model,
  output,
} from '@angular/core';

let nextId = 0;

/**
 * Shim for grass-ds gap 4 (Search field). `value` updates on every keystroke; `searched` is the
 * debounced output the app should react to.
 */
@Component({
  selector: 'pb-search-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="gr-field">
      <label class="gr-field__label" [attr.for]="id">{{ label() }}</label>
      <div class="pb-search" role="search">
        <svg class="pb-search__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3" />
        </svg>
        <input
          class="gr-text-field pb-search__input"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          [id]="id"
          [placeholder]="placeholder()"
          [value]="value()"
          (input)="onInput($any($event.target).value)"
        />
        @if (value()) {
          <button
            type="button"
            class="pb-search__clear"
            [attr.aria-label]="clearLabel()"
            (click)="clear()"
          >
            <svg
              class="pb-search__icon-clear"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                d="M6 6l12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        }
      </div>
    </div>
  `,
})
export class SearchField {
  protected readonly id = `pb-search-${nextId++}`;

  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly clearLabel = input.required<string>();
  readonly debounceMs = input(300);
  readonly value = model('');
  readonly searched = output<string>();

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onInput(next: string): void {
    this.value.set(next);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.searched.emit(next), this.debounceMs());
  }

  protected clear(): void {
    clearTimeout(this.timer);
    this.value.set('');
    this.searched.emit('');
  }
}
