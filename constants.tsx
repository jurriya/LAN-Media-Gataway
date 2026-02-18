
import { FileType, MediaItem } from './types';

export const MOCK_MEDIA: MediaItem[] = [
  {
    id: '1',
    name: 'Inception 4K Collection',
    type: FileType.FOLDER,
    path: '/mnt/storage/movies/Sci-Fi/Inception',
    modified: '2 days ago',
    itemCount: 12,
    size: '45.2 GB',
    isFavorite: false
  },
  {
    id: '2',
    name: 'The.Creator.2023.2160p.HDR.mkv',
    type: FileType.VIDEO,
    path: '/mnt/storage/movies/Sci-Fi/The Creator',
    modified: '2 days ago',
    size: '8.4 GB',
    duration: '2:24:15',
    resolution: '4K',
    thumbnail: 'https://picsum.photos/seed/creator/800/450',
    isFavorite: true
  },
  {
    id: '3',
    name: 'Galaxy_Desktop_Wallpaper.png',
    type: FileType.IMAGE,
    path: '/mnt/media/photos/space/Galaxy_Desktop_Wallpaper.png',
    modified: 'Jun 12, 2024',
    size: '4.2 MB',
    resolution: '3840 x 2160',
    thumbnail: 'https://picsum.photos/seed/galaxy/800/450',
    isFavorite: false
  },
  {
    id: '4',
    name: 'Production_Budget_2024.pdf',
    type: FileType.DOCUMENT,
    path: '/mnt/storage/docs/Production_Budget_2024.pdf',
    modified: 'Today',
    size: '1.8 MB',
    isFavorite: false
  },
  {
    id: '5',
    name: 'NASA_Interstellar_Footage_RAW.mp4',
    type: FileType.VIDEO,
    path: '/mnt/storage/movies/NASA/Interstellar',
    modified: 'Yesterday',
    size: '2.1 GB',
    duration: '0:45:10',
    resolution: '1080p',
    thumbnail: 'https://picsum.photos/seed/interstellar/800/450',
    isFavorite: false
  },
  {
    id: '6',
    name: 'Interstellar.2014.1080p.BluRay.x264.mp4',
    type: FileType.VIDEO,
    path: '/mnt/storage/movies/Sci-Fi/Interstellar.2014',
    modified: 'Oct 24, 2023',
    size: '12.42 GB',
    duration: '2:49:03',
    resolution: '1080p',
    thumbnail: 'https://picsum.photos/seed/movie/800/450',
    isFavorite: true
  }
];
