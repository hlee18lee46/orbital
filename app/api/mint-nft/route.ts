
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import FormData from "form-data";
import bs58 from "bs58";

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey,
} from "@metaplex-foundation/umi";

import {
  mplTokenMetadata,
  createNft,
} from "@metaplex-foundation/mpl-token-metadata";

export const runtime = "nodejs";

// ============================================================
// ORBITAL GRAVITY — SOLANA NFT MINTING API
// POST /api/mint-nft
//
// Flow:
// 1. Receive planetary screenshot and wallet
// 2. Upload screenshot to Pinata IPFS
// 3. Generate planetary NFT metadata
// 4. Upload metadata to Pinata IPFS
// 5. Mint NFT on Solana Devnet
// 6. Send NFT to player's wallet
// ============================================================

const WORLDS = {
  Earth: {
    gravity: 9.81,
    type: "Terrestrial Planet",
  },
  Moon: {
    gravity: 1.62,
    type: "Natural Satellite",
  },
  Mars: {
    gravity: 3.71,
    type: "Terrestrial Planet",
  },
  Europa: {
    gravity: 1.31,
    type: "Moon of Jupiter",
  },
  Titan: {
    gravity: 1.35,
    type: "Moon of Saturn",
  },
} as const;

type PlanetName = keyof typeof WORLDS;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    { status }
  );
}

export async function POST(req: NextRequest) {
  try {
    // ========================================================
    // 1. Read form data
    // ========================================================

    const form = await req.formData();

    const recipientWallet = form.get("recipientWallet");
    const image = form.get("image");

    const rawPlanet =
      form.get("planet") ||
      form.get("world") ||
      "Earth";

    const planetInput = String(rawPlanet).trim();

    const planet = Object.keys(WORLDS).find(
      (name) =>
        name.toLowerCase() === planetInput.toLowerCase()
    ) as PlanetName | undefined;

    // ========================================================
    // 2. Validate wallet and planet
    // ========================================================

    if (
      typeof recipientWallet !== "string" ||
      !recipientWallet.trim()
    ) {
      return errorResponse(
        "recipientWallet is required",
        400
      );
    }

    let owner;

    try {
      owner = publicKey(recipientWallet.trim());
    } catch {
      return errorResponse(
        "Invalid Solana recipient wallet",
        400
      );
    }

    if (!planet) {
      return errorResponse(
        "Invalid planet. Supported: Earth, Moon, Mars, Europa, Titan",
        400
      );
    }

    const world = WORLDS[planet];

    // ========================================================
    // 3. Validate uploaded image
    // ========================================================

    if (!(image instanceof File)) {
      return errorResponse(
        "An image file is required",
        400
      );
    }

    if (!ALLOWED_TYPES.includes(image.type)) {
      return errorResponse(
        "Only PNG, JPEG, and WebP are supported",
        400
      );
    }

    if (image.size === 0 || image.size > MAX_IMAGE_SIZE) {
      return errorResponse(
        "Image must be between 1 byte and 10 MB",
        400
      );
    }

    const imageBuffer = Buffer.from(
      await image.arrayBuffer()
    );

    // Check actual file signature, not just MIME type.
    const isPng =
      imageBuffer.subarray(0, 8).equals(
        Buffer.from([
          137, 80, 78, 71, 13, 10, 26, 10,
        ])
      );

    const isJpeg =
      imageBuffer[0] === 0xff &&
      imageBuffer[1] === 0xd8 &&
      imageBuffer[2] === 0xff;

    const isWebp =
      imageBuffer.toString("ascii", 0, 4) === "RIFF" &&
      imageBuffer.toString("ascii", 8, 12) === "WEBP";

    const validSignature =
      (image.type === "image/png" && isPng) ||
      (image.type === "image/jpeg" && isJpeg) ||
      (image.type === "image/webp" && isWebp);

    if (!validSignature) {
      return errorResponse(
        "Image contents do not match its file type",
        400
      );
    }

    // ========================================================
    // 4. Environment variables
    // ========================================================

    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataApiSecret = process.env.PINATA_API_SECRET;
    const pinataGateway = process.env.PINATA_GATEWAY;

    const solanaPrivateKey =
      process.env.SOLANA_PRIVATE_KEY_BASE58;

    const rpcUrl =
      process.env.SOLANA_RPC_URL ||
      "https://api.devnet.solana.com";

    if (!pinataApiKey || !pinataApiSecret) {
      return errorResponse(
        "Pinata API credentials are missing",
        500
      );
    }

    if (!pinataGateway) {
      return errorResponse(
        "PINATA_GATEWAY is missing",
        500
      );
    }

    if (!solanaPrivateKey) {
      return errorResponse(
        "SOLANA_PRIVATE_KEY_BASE58 is missing",
        500
      );
    }

    // Restrict this implementation to Devnet.
    if (
      !rpcUrl.includes("devnet.solana.com")
    ) {
      return errorResponse(
        "This minting endpoint is configured for Solana Devnet only",
        500
      );
    }

    const gatewayBase = pinataGateway
      .replace(/\/+$/, "")
      .replace(/\/ipfs$/, "");

    let gatewayUrl: URL;

    try {
      gatewayUrl = new URL(gatewayBase);

      if (gatewayUrl.protocol !== "https:") {
        throw new Error("HTTPS required");
      }
    } catch {
      return errorResponse(
        "PINATA_GATEWAY must be a valid HTTPS URL",
        500
      );
    }

    // ========================================================
    // 5. Upload screenshot to Pinata
    // ========================================================

    const uploadForm = new FormData();

    const extension =
      image.type === "image/jpeg"
        ? "jpg"
        : image.type === "image/webp"
          ? "webp"
          : "png";

    uploadForm.append("file", imageBuffer, {
      filename:
        `orbital-${planet.toLowerCase()}-${Date.now()}.${extension}`,
      contentType: image.type,
    });

    const pinataHeaders = {
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataApiSecret,
    };

    const imageUpload = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      uploadForm,
      {
        headers: {
          ...uploadForm.getHeaders(),
          ...pinataHeaders,
        },
        maxBodyLength: MAX_IMAGE_SIZE + 1024 * 1024,
        timeout: 60000,
      }
    );

    const imageCID: string =
      imageUpload.data.IpfsHash;

    if (!imageCID) {
      throw new Error(
        "Pinata did not return an image CID"
      );
    }

    const imageUrl =
      `${gatewayBase}/ipfs/${imageCID}`;

    // ========================================================
    // 6. Build NFT metadata
    // ========================================================

    const captureDate = new Date().toISOString();

    const name =
      `Orbital Gravity - ${planet}`;

    const symbol = "ORBIT";

    const description =
      `A planetary exploration photograph from ${planet}, ` +
      `captured in Orbital Gravity. ` +
      `Surface gravity: ${world.gravity} m/s². ` +
      `This is a simulated environment, not a real space photograph.`;

    const metadata = {
      name,
      symbol,
      description,

      seller_fee_basis_points: 0,

      image: imageUrl,

      attributes: [
        {
          trait_type: "Planet",
          value: planet,
        },
        {
          trait_type: "Surface Gravity",
          value: `${world.gravity} m/s²`,
        },
        {
          trait_type: "World Type",
          value: world.type,
        },
        {
          trait_type: "Capture Date",
          value: captureDate,
        },
        {
          trait_type: "Project",
          value: "Orbital Gravity",
        },
        {
          trait_type: "Environment",
          value: "3D Simulation",
        },
      ],

      properties: {
        files: [
          {
            uri: imageUrl,
            type: image.type,
          },
        ],
        category: "image",
      },
    };

    // ========================================================
    // 7. Upload metadata to Pinata
    // ========================================================

    const metadataUpload = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      metadata,
      {
        headers: {
          "Content-Type": "application/json",
          ...pinataHeaders,
        },
        timeout: 60000,
      }
    );

    const metadataCID: string =
      metadataUpload.data.IpfsHash;

    if (!metadataCID) {
      throw new Error(
        "Pinata did not return a metadata CID"
      );
    }

    const metadataUrl =
      `${gatewayBase}/ipfs/${metadataCID}`;

    // ========================================================
    // 8. Initialize Solana UMI
    // ========================================================

    let secretKey: Uint8Array;

    try {
      secretKey = bs58.decode(solanaPrivateKey);

      if (secretKey.length !== 64) {
        throw new Error("Invalid key length");
      }
    } catch {
      return errorResponse(
        "Invalid SOLANA_PRIVATE_KEY_BASE58",
        500
      );
    }

    const umi = createUmi(rpcUrl).use(
      mplTokenMetadata()
    );

    const serverKeypair =
      umi.eddsa.createKeypairFromSecretKey(
        secretKey
      );

    umi.use(keypairIdentity(serverKeypair));

    // ========================================================
    // 9. Mint NFT
    // ========================================================

    const mint = generateSigner(umi);

    const result = await createNft(umi, {
      mint,

      name,
      symbol,

      uri: metadataUrl,

      sellerFeeBasisPoints: percentAmount(0),

      tokenOwner: owner,

      isMutable: false,
    }).sendAndConfirm(umi);

    // ========================================================
    // 10. Return NFT result
    // ========================================================

    const mintAddress = mint.publicKey.toString();

    const signature = bs58.encode(
      result.signature
    );

    const explorerUrl =
      `https://explorer.solana.com/address/${mintAddress}?cluster=devnet`;

    return NextResponse.json({
      ok: true,

      project: "Orbital Gravity",
      network: "devnet",

      recipientWallet,

      nft: {
        mintAddress,
        name,
        symbol,
        planet,
        gravity: world.gravity,
        captureDate,
      },

      transaction: {
        signature,
      },

      image: {
        cid: imageCID,
        ipfsUri: `ipfs://${imageCID}`,
        url: imageUrl,
      },

      metadata: {
        cid: metadataCID,
        ipfsUri: `ipfs://${metadataCID}`,
        url: metadataUrl,
      },

      explorer: explorerUrl,
    });
  } catch (error: unknown) {
    console.error(
      "[Orbital Gravity] NFT mint failed:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "NFT minting failed";

    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "production"
            ? "NFT minting failed. Please try again."
            : message,
      },
      { status: 500 }
    );
  }
}
