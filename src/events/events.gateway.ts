import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayDisconnect, OnGatewayConnection {
  roomData: Record<string, { question: string }>;

  @WebSocketServer()
  server: Server;
  handleConnection = async (socket: Socket) => {
    const { roomId } = socket.handshake.auth;
    socket.join(roomId);
    this.server
      .to(roomId)
      .emit('SendQuestion', this.roomData?.[roomId] || { question: "wait for host start" });
  };
  handleDisconnect = async (socket: Socket) => {
    const { roomId } = socket.handshake.auth;
    this.server.to(roomId).except(socket.id).emit('UpdateRoom');
  };

  @SubscribeMessage('SendQuestion')
  handleSetQuestion(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { question: string },
  ) {
    const { roomId } = socket.handshake.auth;
    this.server.to(roomId).emit('SendQuestion', data);
    this.roomData = { ...this.roomData, [roomId]: data };
  }

  // @SubscribeMessage('UpdateRoom')
  // handleUpdateRoom(@ConnectedSocket() socket: Socket) {
  //   const { roomId } = socket.handshake.auth;
  //   this.server.to(roomId).emit('UpdateRoom');
  // }

  // @SubscribeMessage('UpdateRoomExceptMe')
  // handleUpdateRoomExceptMe(@ConnectedSocket() socket: Socket) {
  //   const { roomId } = socket.handshake.auth;
  //   this.server.to(roomId).except(socket.id).emit('UpdateRoomExceptMe');
  // }
}
