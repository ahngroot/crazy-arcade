declare module "postject" {
  export function inject(
    filename: string,
    resourceName: string,
    data: Buffer,
    options: { sentinelFuse: string; machoSegmentName?: string },
  ): Promise<void>;
}
