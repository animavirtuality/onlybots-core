export const OnlyBotsLayerType = ['body', 'eye', 'arm', 'leg', 'top', 'tail'] as const;
export type OnlyBotsLayerType = typeof OnlyBotsLayerType[number];

export const OnlyBotsLayerId: Record<OnlyBotsLayerType, number> = {
    body: OnlyBotsLayerType.indexOf('body'),
    eye: OnlyBotsLayerType.indexOf('eye'),
    arm: OnlyBotsLayerType.indexOf('arm'),
    leg: OnlyBotsLayerType.indexOf('leg'),
    top: OnlyBotsLayerType.indexOf('top'),
    tail: OnlyBotsLayerType.indexOf('tail'),
};
