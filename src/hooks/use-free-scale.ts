import { useState, useRef, useEffect, useMemo, useCallback } from "react";

// 缩放比例
const defaultScaleStep = 0.1;

export interface ITransRes {
  transXY: [number, number];
  scale: number;
  rotate: number;
}

export type IDomRect = Pick<DOMRect, "height" | "width"> | undefined;

export interface IRectData {
  originConatinerRect: IDomRect;
  originChildRect: IDomRect;
}

export enum IAction {
  MOVE = "move",
  SCALE = "scale",
}

export interface IUseFreeScale {
  // 自定义缩放比例
  scaleStep?: number;
  // 自定义变换结果，如限制缩放比例，边界检测等
  customTrans?: (
    prev: ITransRes,
    v: ITransRes,
    rect: IRectData,
    action: IAction
  ) => ITransRes;
}

export const useFreeScale = ({
  scaleStep = defaultScaleStep,
  customTrans = (_prev, v) => v,
}: IUseFreeScale) => {
  const [transXY, setTransXY] = useState<[number, number]>([0, 0]);
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLDivElement>(null);

  const mousedownLock = useRef(false);
  const mouseXY = useRef<[number, number]>([0, 0]);
  const containerRectRef = useRef<IDomRect>(undefined);
  const childRectRef = useRef<IDomRect>(undefined);

  const transformConfigRef = useRef<ITransRes>({
    transXY,
    scale,
    rotate,
  });

  transformConfigRef.current = {
    transXY,
    scale,
    rotate,
  };

  const getOriginRect = useCallback(() => {
    const originConatinerRect =
      containerRectRef.current || containerRef.current?.getBoundingClientRect();
    containerRectRef.current = originConatinerRect;

    const originChildRect =
      childRectRef.current || childRef.current?.getBoundingClientRect();
    childRectRef.current = originChildRect;

    return { originConatinerRect, originChildRect };
  }, []);

  const handleMove = useCallback(
    (e: MouseEvent) => {
      if (!mousedownLock.current) {
        return;
      }
      e.preventDefault();
      const transXY_ = transformConfigRef.current.transXY;
      const deltaXY = [
        e.clientX - mouseXY.current[0],
        e.clientY - mouseXY.current[1],
      ];
      mouseXY.current = [e.clientX, e.clientY];
      const customTransRes = customTrans(
        transformConfigRef.current,
        {
          ...transformConfigRef.current,
          transXY: [transXY_[0] + deltaXY[0], transXY_[1] + deltaXY[1]],
        },
        getOriginRect(),
        IAction.MOVE
      );

      setTransXY(customTransRes.transXY);
    },
    [customTrans, getOriginRect]
  );

  const handleGesture = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      if (e.deltaY === 0) {
        return;
      }

      if (mousedownLock.current) {
        return;
      }

      const direc = e.deltaY > 0 ? -1 : 1;

      // 缩放中心点，缩放方向
      // 先假定缩放中心点为容器中心
      const container = containerRef.current;
      const child = childRef.current;
      if (container && child) {
        // const containerRect = container.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();
        const childCenter = [
          childRect.left + childRect.width / 2,
          childRect.top + childRect.height / 2,
        ];

        // 焦点
        const targetPoint = [e.clientX, e.clientY];

        const deltaOffset = [
          (((targetPoint[0] - childCenter[0]) * direc) /
            transformConfigRef.current.scale) *
            scaleStep,
          (((targetPoint[1] - childCenter[1]) * direc) /
            transformConfigRef.current.scale) *
            scaleStep,
        ];

        const customTransRes = customTrans(
          transformConfigRef.current,
          {
            transXY: [
              transformConfigRef.current.transXY[0] - deltaOffset[0],
              transformConfigRef.current.transXY[1] - deltaOffset[1],
            ],
            scale: transformConfigRef.current.scale + direc * scaleStep,
            rotate: transformConfigRef.current.rotate,
          },
          getOriginRect(),
          IAction.SCALE
        );

        setScale(customTransRes.scale);
        setTransXY(customTransRes.transXY);
        setRotate(customTransRes.rotate);
      }
    },
    [customTrans, getOriginRect, scaleStep]
  );

  useEffect(() => {
    const container = containerRef.current;
    const child = childRef.current;
    if (container && child) {
      container.addEventListener("wheel", handleGesture);
      return () => {
        container.removeEventListener("wheel", handleGesture);
      };
    }
  }, [handleGesture]);

  useEffect(() => {
    const child = childRef.current;
    const container = containerRef.current;

    if (child && container) {
      const handleMouseDown = (e: MouseEvent) => {
        mousedownLock.current = true;
        mouseXY.current = [e.clientX, e.clientY];
      };

      const handleMouseUp = () => {
        mousedownLock.current = false;
      };

      child.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        child.removeEventListener("mousedown", handleMouseDown);
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [handleMove]);

  const transform = useMemo(() => {
    return `translateX(${transXY[0]}px) translateY(${transXY[1]}px) rotate(${rotate}deg) scale(${scale})`;
  }, [rotate, scale, transXY]);

  return {
    transformConfigRef,
    containerRef,
    childRef,
    transform,
    rotate,
    scale,
    transXY,
    setRotate,
    setScale,
    setTransXY,
  };
};
