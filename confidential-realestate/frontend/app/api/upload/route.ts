import { NextRequest, NextResponse } from "next/server";

const PINATA_FILE_ENDPOINT = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const buildGatewayUrl = (cid: string) => {
  const base = process.env.PINATA_GATEWAY?.replace(/\/$/, "") || "https://gateway.pinata.cloud/ipfs";
  return `${base}/${cid}`;
};

const uploadToPinata = async (file: File) => {
  if (!process.env.PINATA_JWT) {
    throw new Error("Pinata credentials are not configured");
  }

  const formData = new FormData();
  formData.append("file", file, file.name || "upload");

  const response = await fetch(PINATA_FILE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
    },
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : payload?.error?.details || "Failed to upload to Pinata";
    throw new Error(message);
  }

  const cid = payload.IpfsHash as string | undefined;
  if (!cid) {
    throw new Error("Pinata response did not include a CID");
  }

  return { cid, url: buildGatewayUrl(cid) };
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const result = await uploadToPinata(file);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Pinata upload error:", error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    const statusCode = message.includes("credentials") ? 500 : 400;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
