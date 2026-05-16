export default async (req: any, res: any) => {
  res.status(200).json({
    ping: true,
    url: req.url,
    method: req.method,
  });
};
