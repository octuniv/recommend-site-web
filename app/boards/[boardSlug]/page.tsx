import Board from "@/components/Boards/General/Board";
import { FetchAllBoards, FetchPostsByBoardId } from "@/lib/actions";
import { userStatus } from "@/lib/authState";
import { BoardPurpose, PostDto, VideoCardInfo } from "@/lib/definition";
import { canCreatePost } from "@/lib/util";
import { notFound } from "next/navigation";

export async function generateStaticParams() {
  const boards = await FetchAllBoards();
  return boards
    .filter((board) => board.boardType === BoardPurpose.GENERAL)
    .map((board) => ({ boardSlug: board.slug }));
}

export const revalidate = 3600;

const Page = async ({ params }: { params: Promise<{ boardSlug: string }> }) => {
  const { boardSlug } = await params;

  const boards = await FetchAllBoards();
  const currentBoard = boards.find(
    (board) =>
      board.slug === boardSlug && board.boardType === BoardPurpose.GENERAL
  );

  if (!currentBoard) {
    notFound();
  }

  let videoData: VideoCardInfo[] = [];

  const posts = await FetchPostsByBoardId(currentBoard.id);
  // page.tsx 내부의 posts 매핑 부분
  videoData = posts.map((post: PostDto) => ({
    id: post.id,
    title: post.title,
    nickname: post.nickname,
    createdAt: post.createdAt,
    videoUrl: post.videoUrl, // optional 필드 유지
  }));

  const sortedVideoData = videoData.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const userStatusInfo = await userStatus();

  const isEditable = canCreatePost({
    user: userStatusInfo,
    board: currentBoard,
  });

  return (
    <Board
      boardSlug={boardSlug}
      sortedVideos={sortedVideoData}
      isEditable={isEditable}
    />
  );
};

export default Page;
