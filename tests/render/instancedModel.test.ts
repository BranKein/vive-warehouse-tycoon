import { BoxGeometry, Color, Group, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { InstancedModel } from '@/render/InstancedModel';

describe('InstancedModel', () => {
  it('keeps tints when it grows past its capacity', () => {
    const prototype = new Group();
    prototype.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
    const model = new InstancedModel(prototype, 1);
    const matrix = new Matrix4();
    const tint = new Color();

    model.begin();
    for (let index = 0; index < 5; index += 1) model.add(matrix, tint.setRGB(index / 10, 0, 0));

    expect(model.size).toBe(5);
    const mesh = model.group.children[0] as unknown as { getColorAt(index: number, target: Color): void };
    const read = new Color();
    mesh.getColorAt(3, read);
    expect(read.r).toBeCloseTo(0.3);
  });
});
