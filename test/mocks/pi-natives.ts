// Mock for @oh-my-pi/pi-natives in Vitest under Node.js
export const glob = () => [];
export const grep = () => [];
export const listWorkspace = () => [];
export const sliceWithWidth = (s: string, startCol = 0, length = s.length) => ({
    text: s.slice(startCol, startCol + length),
});
export const truncateToWidth = (s: string, width = s.length) => s.slice(0, width);
export const visibleWidth = (s: string) => s.length;
const KEY_SEQUENCES = {
    down: ["\x1b[B"],
    enter: ["\r", "\n"],
    j: ["j"],
    k: ["k"],
    return: ["\r"],
    up: ["\x1b[A"],
} as const;

function isRecognizedKey(keyId: string): keyId is keyof typeof KEY_SEQUENCES {
    return Object.hasOwn(KEY_SEQUENCES, keyId);
}

export const matchesKey = (data: string, keyId: string, kittyProtocolActive: boolean): boolean => {
    void kittyProtocolActive;
    if (isRecognizedKey(keyId)) {
        return KEY_SEQUENCES[keyId].some((sequence) => sequence === data);
    }
    return false;
};
