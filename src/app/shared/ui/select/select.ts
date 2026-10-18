import { Directive } from '@angular/core';

/** Shim for grass-ds gap 3 (Select). Keeps the native `<select>`; only adds the look. */
@Directive({
  selector: 'select[pbSelect]',
  host: { class: 'pb-select' },
})
export class PbSelect {}
