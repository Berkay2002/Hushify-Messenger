import React from 'react';
import Image from 'next/image';
import { ArrowLeft, Phone, Video, MoreVertical } from 'lucide-react';
import { Contact } from '../../context/ChatContext';

interface ChatHeaderProps {
  contact: Contact;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ contact }) => {
  // Format last seen time
  const formatLastSeen = (date?: Date) => {
    if (!date) return 'Last seen unknown';
    
    const now = new Date();
    const lastSeen = new Date(date);
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) {
      return 'Last seen just now';
    }
    if (diffMins < 60) {
      return `Last seen ${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    }
    if (diffHours < 24) {
      return `Last seen ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    }
    if (diffDays < 7) {
      return `Last seen ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
    
    return `Last seen on ${lastSeen.toLocaleDateString()}`;
  };

  return (
    <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-white">
      <div className="flex items-center">
        <button className="p-1 mr-2 rounded-full hover:bg-gray-100 lg:hidden">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        <Image
          src={contact.avatar || '/api/placeholder/40/40'}
          alt={contact.name}
          width={40}
          height={40}
          className="h-10 w-10 rounded-full mr-3"
        />
        <div>
          <h3 className="font-medium">{contact.nickname || contact.name}</h3>
          <p className="text-xs text-gray-500">
            {contact.isOnline ? 'Online' : formatLastSeen(contact.lastSeen)}
          </p>
        </div>
      </div>
      <div className="flex">
        <button className="p-2 rounded-full hover:bg-gray-100 mr-1">
          <Phone className="h-5 w-5 text-gray-500" />
        </button>
        <button className="p-2 rounded-full hover:bg-gray-100 mr-1">
          <Video className="h-5 w-5 text-gray-500" />
        </button>
        <button className="p-2 rounded-full hover:bg-gray-100">
          <MoreVertical className="h-5 w-5 text-gray-500" />
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;