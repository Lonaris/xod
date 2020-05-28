
// clang-format off
{{#global}}
#include <Circle.h>
{{/global}}
// clang-format on

struct State {
    uint8_t mem[sizeof(CircleSolid)];
    CircleSolid* circleSolidColored;
    int16_t x, y, r;
    XColor fillColor;
};

// clang-format off
{{ GENERATED_CODE }}
// clang-format on

void evaluate(Context ctx) {
    auto state = getState(ctx);

    auto gfx = getValue<input_GFX>(ctx);
    state->fillColor = getValue<input_C>(ctx);

    int16_t x = (int16_t)getValue<input_X>(ctx);
    int16_t y = (int16_t)getValue<input_Y>(ctx);
    int16_t r = (int16_t)getValue<input_R>(ctx);

    if (isSettingUp()) {
        state->circleSolidColored = new (state->mem) CircleSolid(gfx);
    }

    if (isSettingUp() || x != state->x || y != state->y || r != state->r || isInputDirty<input_C>(ctx)) {
        state->x = x;
        state->y = y;
        state->r = r;
        state->circleSolidColored->setPosition(x, y, r);
        state->circleSolidColored->setStyle(&state->fillColor);
        emitValue<output_GFXU0027>(ctx, state->circleSolidColored);
    }

    if (isInputDirty<input_GFX>(ctx)) {
        emitValue<output_GFXU0027>(ctx, state->circleSolidColored);
    }
}
