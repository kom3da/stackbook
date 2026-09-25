// Pure text helpers shared by build-time code and browser scripts

export const plain = (t: string) => t.replace(/\*\*|`/g, '');
