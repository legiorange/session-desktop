import { SignalService } from '../../protobuf';
import { SnodeNamespaces } from '../apis/snode_api/namespaces';

export type RawMessage = {
  identifier: string;
  plainTextBuffer: Uint8Array;
  device: string;
  ttl: number;
  encryption: SignalService.Envelope.Type;
  namespace: SnodeNamespaces;
};

// For building RawMessages from JSON
export interface PartialRawMessage {
  identifier: string;
  plainTextBuffer: any;
  device: string;
  ttl: number;
  encryption: number;
}
