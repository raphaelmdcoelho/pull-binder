import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PbSelect } from './select';

@Component({
  imports: [PbSelect],
  template: `<select pbSelect>
    <option>a</option>
  </select>`,
})
class Host {}

describe('PbSelect', () => {
  it('keeps the native select and adds the shim class', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const select = (fixture.nativeElement as HTMLElement).querySelector('select')!;
    expect(select.classList.contains('pb-select')).toBe(true);
  });
});
