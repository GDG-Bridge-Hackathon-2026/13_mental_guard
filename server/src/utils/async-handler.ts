import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * async route handler용 wrapper. throw하면 자동으로 next(err)로 흘러감.
 * Express 5+는 native하게 지원하지만 4.x에선 필요.
 */
export const ah = (fn: AsyncFn): RequestHandler => (req, res, next) => {
  fn(req, res, next).catch(next);
};
