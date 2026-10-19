/** jsdom has no <dialog> methods; give it just enough for grass-ds's Dialog. */
export function polyfillDialog(): void {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement, value?: string) {
    this.removeAttribute('open');
    this.returnValue = value ?? '';
    this.dispatchEvent(new Event('close'));
  };
}
