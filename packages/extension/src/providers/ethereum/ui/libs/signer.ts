import { InternalMethods, InternalOnMessageResponse } from '@/types/messenger';
import { FeeMarketEIP1559Transaction, LegacyTransaction } from '@ethereumjs/tx';
import { SignerTransactionOptions, SignerMessageOptions } from '../types';
import HWwallet from '@enkryptcom/hw-wallets';
import { HWwalletType } from '@enkryptcom/types';
import { fromRpcSig, hashPersonalMessage } from '@ethereumjs/util';
import { getCustomError } from '@/libs/error';
import { bufferToHex } from '@enkryptcom/utils';
import sendUsingInternalMessengers from '@/libs/messenger/internal-messenger';

/**
 * Sign a transaction
 */
const TransactionSigner = (
  options: SignerTransactionOptions,
): Promise<LegacyTransaction | FeeMarketEIP1559Transaction> => {
  const { account, network, payload } = options;
  if (account.isHardware) {
    const hwwallets = new HWwallet();
    return hwwallets
      .signTransaction({
        transaction: payload as any,
        networkName: network.name,
        pathIndex: account.pathIndex.toString(),
        pathType: {
          basePath: account.basePath,
          path: account.HWOptions!.pathTemplate,
        },
        wallet: account.walletType as unknown as HWwalletType,
      })
      .then((rpcsig: string) => {
        const rpcSig = fromRpcSig(rpcsig as `0x${string}`);
        const signedTx = payload.addSignature(
          BigInt(rpcSig.v),
          rpcSig.r,
          rpcSig.s,
          true,
        );
        return signedTx;
      })
      .catch(e => {
        return Promise.reject({
          error: getCustomError(e.message),
        });
      });
  } else {
    const msgHash = bufferToHex(payload.getHashedMessageToSign());
    return sendUsingInternalMessengers({
      method: InternalMethods.sign,
      params: [msgHash, account],
    }).then(res => {
      if (res.error) {
        return Promise.reject(res);
      } else {
        const rpcSig = fromRpcSig(JSON.parse(res.result as string) || '0x');
        const signedTx = payload.addSignature(
          rpcSig.v,
          rpcSig.r,
          rpcSig.s,
          true,
        );
        return signedTx;
      }
    });
  }
};

/**
 * Sign a message
 */
const MessageSigner = (
  options: SignerMessageOptions,
): Promise<InternalOnMessageResponse> => {
  const { account, network, payload } = options;
  if (account.isHardware) {
    const hwwallets = new HWwallet();
    return hwwallets
      .signPersonalMessage({
        message: payload,
        networkName: network.name,
        pathIndex: account.pathIndex.toString(),
        pathType: {
          basePath: account.basePath,
          path: account.HWOptions!.pathTemplate,
        },
        wallet: account.walletType as unknown as HWwalletType,
      })
      .then((res: string) => ({
        result: JSON.stringify(res),
      }))
      .catch((e: any) => {
        return Promise.reject({
          error: getCustomError(e.message),
        });
      });
  } else {
    const msgHash = bufferToHex(hashPersonalMessage(payload));
    return sendUsingInternalMessengers({
      method: InternalMethods.sign,
      params: [msgHash, account],
    }).then(res => {
      if (res.error) return res;
      return {
        result: res.result,
      };
    });
  }
};

export { TransactionSigner, MessageSigner };
