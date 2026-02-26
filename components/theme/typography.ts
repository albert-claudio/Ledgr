import { TextStyle } from "react-native";

export const typography = {
    title: {
        fontSize: 24,
        fontWeight: '600',
    } as TextStyle,
    header: {
        fontSize: 18,
        fontWeight: '600',
    } as TextStyle,
    button: {
        fontSize: 16,
        fontWeight: '600',
    } as TextStyle,
    body: {
        fontSize: 14,
        fontWeight: '400',
    } as TextStyle,
    caption: {
        fontSize: 12,
        fontWeight: '400',
    } as TextStyle,
    small: {
        fontSize: 10,
        fontWeight: '400',
    } as TextStyle,
} as const;

export type Typography = typeof typography;