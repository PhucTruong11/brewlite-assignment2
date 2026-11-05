import { BadRequestException } from '@nestjs/common';
import { assertTransition } from './orders-state.js';

describe('Order State Machine', () => {
    it('cho phép PAID -> PREPARING', () => {
        expect(() => assertTransition('PAID', 'PREPARING')).not.toThrow();
    });

    it('cho phép luồng đầy đủ PREPARING -> READY -> COMPLETED', () => {
        expect(() => assertTransition('PREPARING', 'READY')).not.toThrow();
        expect(() => assertTransition('READY', 'COMPLETED')).not.toThrow();
    });

    it('chặn nhảy cóc PAID -> COMPLETED', () => {
        expect(() => assertTransition('PAID', 'COMPLETED')).toThrow(BadRequestException);
    });

    it('chặn đi ngược READY -> PAID', () => {
        expect(() => assertTransition('READY', 'PAID')).toThrow(BadRequestException);
    });

    it('trạng thái cuối không chuyển được nữa', () => {
        expect(() => assertTransition('COMPLETED', 'CANCELLED')).toThrow(BadRequestException);
        expect(() => assertTransition('CANCELLED', 'PAID')).toThrow(BadRequestException);
    });
});