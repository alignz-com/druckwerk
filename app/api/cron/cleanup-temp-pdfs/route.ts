import { NextResponse } from "next/server"
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3"
import { s3, UPLOADS_BUCKET } from "@/lib/s3"

export const runtime = "nodejs"

const MAX_AGE_MS = 2 * 60 * 60 * 1000 // 2 hours

function authorize(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error("[api/cleanup-temp-pdfs] missing CRON_SECRET env")
    return new Response("Server misconfigured", { status: 500 })
  }
  const header = request.headers.get("authorization")
  if (header !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 })
  }
  return null
}

export async function GET(request: Request) {
  const unauthorized = authorize(request)
  if (unauthorized) return unauthorized
  const cutoff = new Date(Date.now() - MAX_AGE_MS)
  const toDelete: { Key: string }[] = []

  let continuationToken: string | undefined
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: UPLOADS_BUCKET,
      Prefix: "temp/",
      ContinuationToken: continuationToken,
    }))
    for (const obj of res.Contents ?? []) {
      if (obj.Key && obj.LastModified && obj.LastModified < cutoff) {
        toDelete.push({ Key: obj.Key })
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  if (toDelete.length > 0) {
    await s3.send(new DeleteObjectsCommand({
      Bucket: UPLOADS_BUCKET,
      Delete: { Objects: toDelete },
    }))
  }

  return NextResponse.json({ deleted: toDelete.length })
}
