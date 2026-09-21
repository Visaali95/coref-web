"""Preprocessing & augmentation transforms.

``build_eval_transform`` is deliberately dependency-light and is reused verbatim by
the inference module, guaranteeing train/serve preprocessing parity.
"""

from __future__ import annotations

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

def build_train_transform(image_size: int, aug):
    from torchvision import transforms as T

    ops = [
        T.RandomResizedCrop(
            image_size,
            scale=tuple(aug.random_resized_crop_scale),
            ratio=(0.8, 1.25),
        )
    ]
    if aug.horizontal_flip:
        ops.append(T.RandomHorizontalFlip(p=aug.horizontal_flip))
    if aug.vertical_flip:
        ops.append(T.RandomVerticalFlip(p=aug.vertical_flip))
    if aug.rotation_degrees:
        ops.append(T.RandomApply([T.RandomRotation(aug.rotation_degrees, expand=False)], p=0.5))
    if aug.color_jitter:
        cj = aug.color_jitter
        ops.append(T.RandomApply([T.ColorJitter(cj, cj, cj, min(cj / 2, 0.5))], p=0.7))
    if aug.grayscale_prob:
        ops.append(T.RandomGrayscale(p=aug.grayscale_prob))
    if aug.gaussian_blur_prob:
        ops.append(T.RandomApply([T.GaussianBlur(3, (0.1, 1.5))], p=aug.gaussian_blur_prob))

    ops += [T.ToTensor(), T.Normalize(IMAGENET_MEAN, IMAGENET_STD)]
    if aug.random_erasing:
        ops.append(T.RandomErasing(p=aug.random_erasing, scale=(0.02, 0.12)))
    return T.Compose(ops)

def build_eval_transform(image_size: int):
    from torchvision import transforms as T

    resize = int(round(image_size * 1.14))
    return T.Compose(
        [
            T.Resize(resize),
            T.CenterCrop(image_size),
            T.ToTensor(),
            T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )
