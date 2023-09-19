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
import { SocketAuth } from './types';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayDisconnect, OnGatewayConnection {
  roomData: Record<
    string,
    {
      currentQuestionId?: string;
      question?: { id: string; title: string };
      users: {
        name: string;
        isHost: boolean;
        online: boolean;
        answer?: Record<string, string>;
      }[];
    }
  > = {};

  @WebSocketServer()
  server: Server;
  handleConnection = async (socket: Socket) => {
    const SocketAuth = socket.handshake.auth as SocketAuth;
    const { roomId } = SocketAuth;
    socket.join(roomId);
    this.handleAddUser(SocketAuth);
    this.server.to(roomId).emit('UpdateQuestion', this.roomData?.[roomId]);
  };
  handleDisconnect = async (socket: Socket) => {
    const SocketAuth = socket.handshake.auth as SocketAuth;
    const { roomId } = SocketAuth;
    this.server.to(roomId).except(socket.id).emit('UpdateRoom');
    this.handleUserOff(SocketAuth);
  };

  handleSendUsers(roomId: string) {
    const users = this.roomData?.[roomId].users || [];
    this.server.to(roomId).emit('UpdateUsers', { users });
  }

  @SubscribeMessage('UpdateUsers')
  sendUpdateUsers(@ConnectedSocket() socket: Socket) {
    const { roomId } = socket.handshake.auth;
    this.handleSendUsers(roomId);
  }

  handleSendQuestion({ roomId, question }) {
    const room = this.roomData[roomId];
    if (room) {
      room.question = question;
      room.currentQuestionId = question.id;
      this.server.to(roomId).emit('UpdateQuestion', { question });
    }
  }

  @SubscribeMessage('SendQuestion')
  sendQuestion(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { question }: { question: { id: string; title: string } },
  ) {
    const { roomId } = socket.handshake.auth;
    this.handleSendQuestion({ roomId, question });
    this.handleSendUsers(roomId);
  }

  @SubscribeMessage('ResetRoom')
  ResetRoom(@ConnectedSocket() socket: Socket) {
    const { roomId } = socket.handshake.auth;
    const room = this.roomData[roomId];
    if (room) {
      this.handleSendQuestion({ roomId, question: {} });
      room.users = room.users.map((user) => ({ ...user, answer: {} }));
      this.handleSendUsers(roomId);
    }
  }

  handleAnswer({
    roomId,
    name,
    answer,
  }: {
    roomId: string;
    name: string;
    answer: string;
  }) {
    const room = this.roomData[roomId];
    if (room) {
      const user = room.users?.find((e) => e.name === name);
      const currentQuestionId = room.currentQuestionId;
      if (user && name && currentQuestionId !== undefined) {
        if (user.answer) {
          user.answer[currentQuestionId] = answer;
        }
      }
    }
  }

  @SubscribeMessage('sendAnswer')
  sendAnswer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { answer, name },
  ) {
    const { roomId } = socket.handshake.auth;
    this.handleAnswer({ answer, name, roomId });
    this.handleSendUsers(roomId);
  }

  handleInitialRoom({ roomId, name, isHost }: SocketAuth) {
    this.roomData[roomId] = {
      users: [{ name, online: true, isHost: !!isHost, answer: {} }],
    };
  }

  handleAddUser({ roomId, name, isHost }: SocketAuth) {
    const room = this.roomData[roomId];
    if (room) {
      const user = room.users?.find((e) => e.name === name);
      if (!user && name)
        room.users?.push({ name, online: true, isHost: !!isHost, answer: {} });
      else user.online = true;
    } else {
      this.handleInitialRoom({ roomId, name, isHost: !!isHost });
    }
    this.handleSendUsers(roomId);
  }

  handleUserOff({ roomId, name }: SocketAuth) {
    const room = this.roomData[roomId];
    if (room) {
      const user = room.users?.find((e) => e.name === name);
      if (user) user.online = false;
    }
    this.handleSendUsers(roomId);
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
